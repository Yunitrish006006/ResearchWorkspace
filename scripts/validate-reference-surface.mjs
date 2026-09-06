#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const config=JSON.parse(fs.readFileSync(path.join(root,"data","reference-surface-map.json"),"utf8"));
const validClassifications=new Set(["port","replace","exclude-domain"]);

for(const family of config.families){
  if(!validClassifications.has(family.classification))throw new Error("Unknown classification: "+family.classification);
  new RegExp(family.pattern);
  if(family.classification!=="exclude-domain"){
    if(!Array.isArray(family.researchEvidence)||family.researchEvidence.length===0)throw new Error("Family has no research evidence: "+family.pattern);
    for(const rel of family.researchEvidence){
      if(!fs.existsSync(path.join(root,rel)))throw new Error("Missing ResearchWorkspace evidence: "+rel);
    }
  }else if(!family.rationale){
    throw new Error("exclude-domain family needs rationale: "+family.pattern);
  }
}

for(const mapping of config.requiredReferencePaths){
  if(!validClassifications.has(mapping.classification))throw new Error("Bad required mapping classification: "+mapping.reference);
  if(mapping.classification!=="exclude-domain"&&!fs.existsSync(path.join(root,mapping.research))){
    throw new Error("Missing required ResearchWorkspace counterpart for "+mapping.reference+": "+mapping.research);
  }
}

const referenceRoot=process.env.TOTEM_REFERENCE_ROOT;
if(referenceRoot){
  const head=execFileSync("git",["rev-parse","HEAD"],{cwd:referenceRoot,encoding:"utf8"}).trim();
  if(head!==config.reference.commit)throw new Error("Totem reference HEAD drift: expected "+config.reference.commit+" got "+head);
  const files=execFileSync("git",["ls-files"],{cwd:referenceRoot,encoding:"utf8"}).split(/\r?\n/).filter(Boolean);
  if(files.length!==config.reference.expectedTrackedFiles){
    throw new Error("Totem reference file-count drift: expected "+config.reference.expectedTrackedFiles+" got "+files.length);
  }
  const uncovered=files.filter((file)=>!config.families.some((family)=>new RegExp(family.pattern).test(file)));
  if(uncovered.length)throw new Error("Unclassified Totem reference files: "+uncovered.join(", "));
  for(const mapping of config.requiredReferencePaths){
    if(!files.includes(mapping.reference))throw new Error("Required Totem reference path missing: "+mapping.reference);
  }
  console.log("Totem reference surface audited: "+files.length+" tracked files, 0 unclassified");
}else{
  console.log("Research reference-surface map OK (upstream tree audit skipped; set TOTEM_REFERENCE_ROOT to enable)");
}
