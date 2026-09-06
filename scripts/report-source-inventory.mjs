#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadKnowledge } from "../intelligence/research-knowledge.mjs";
import { loadSourceIndex } from "../intelligence/source-index.mjs";
import { mappedImpactSurface } from "../intelligence/source-mapping.mjs";

const strict=process.argv.includes("--strict"),knowledge=loadKnowledge(),index=loadSourceIndex();
const outputDir=path.join(knowledge.root,".research-index");
fs.mkdirSync(outputDir,{recursive:true});

const byExtension={};
const byArea={};
for(const record of index.fileRecords??[]){
  const ext=path.extname(record.path).toLowerCase()||"(none)";
  byExtension[ext]=(byExtension[ext]??0)+1;
  const area=record.path.startsWith("docs/thesis/")?"thesis-notes":
    record.path.startsWith("docs/papers/thesis/")?"thesis-paper":
    record.path.startsWith("docs/papers/ieee/")?"ieee-paper":
    record.path.startsWith("docs/experiments/")?"experiments":
    record.path.startsWith("docs/models/")?"models":
    record.path.startsWith("openspec/")?"openspec":
    record.path.startsWith("digital_twin/")?"implementation":
    record.path.startsWith("scripts/")?"scripts":
    record.path.startsWith("tests/")?"tests":"other";
  byArea[area]=(byArea[area]??0)+1;
}
const registeredSources=[...new Set(knowledge.claims.flatMap(c=>c.sources??[]))];
const presentPaths=new Set((index.fileRecords??[]).map(x=>x.path));
const missingRegisteredSources=registeredSources.filter(source=>!presentPaths.has(source));
const mapping=mappedImpactSurface(registeredSources,{knowledge,index});
const registeredCoverage=mapping.files.map(item=>({file:item.file,entityIds:item.mappings.map(x=>x.entityId),mappingMode:item.mappingMode}));
const inventory={
  schemaVersion:1,generatedAt:new Date().toISOString(),repository:index.repository,
  rootPresent:index.rootPresent,files:index.files,chunks:index.chunks.length,
  byExtension:Object.fromEntries(Object.entries(byExtension).sort()),
  byArea:Object.fromEntries(Object.entries(byArea).sort()),
  registeredClaimSources:registeredSources.length,
  missingRegisteredSources,registeredCoverage
};
fs.writeFileSync(path.join(outputDir,"source-inventory.json"),JSON.stringify(inventory,null,2)+"\n");
const lines=[
  "# ResearchWorkspace source/document inventory","",
  "Generated: "+inventory.generatedAt,"",
  "- Repository: `"+inventory.repository+"`",
  "- Indexed files: "+inventory.files,
  "- Chunks: "+inventory.chunks,
  "- Registered Claim sources: "+inventory.registeredClaimSources,
  "- Missing registered sources: "+inventory.missingRegisteredSources.length,"",
  "## Areas","",
  ...Object.entries(inventory.byArea).map(([area,count])=>"- "+area+": "+count),
  "","## Registered Claim-source coverage","",
  ...inventory.registeredCoverage.map(x=>"- `"+x.file+"` → "+(x.entityIds.join(", ")||"UNMAPPED")+" ("+x.mappingMode+")"),
  ""
];
if(missingRegisteredSources.length)lines.push("## Missing registered sources","",...missingRegisteredSources.map(x=>"- `"+x+"`"),"");
fs.writeFileSync(path.join(outputDir,"source-inventory.md"),lines.join("\n")+"\n");
if(strict){
  if(!index.rootPresent)throw new Error("Canonical thesis repository is not present");
  if(index.files<1||index.chunks<1)throw new Error("Source index is empty");
  if(missingRegisteredSources.length)throw new Error("Missing registered Claim sources: "+missingRegisteredSources.join(", "));
}
console.log(JSON.stringify({...inventory,json:".research-index/source-inventory.json",markdown:".research-index/source-inventory.md"},null,2));
