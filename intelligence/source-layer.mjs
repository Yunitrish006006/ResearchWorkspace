import crypto from "node:crypto";
import path from "node:path";
import { loadKnowledge } from "./research-knowledge.mjs";
import { loadSourceIndex } from "./source-index.mjs";
import { mapSourceFilesToEntities } from "./source-mapping.mjs";

const FAMILIES=Object.freeze([
  {id:"thesis",label:"Thesis sources",match:p=>p.startsWith("docs/thesis/")||p.startsWith("docs/papers/thesis/")},
  {id:"ieee",label:"IEEE manuscript",match:p=>p.startsWith("docs/papers/ieee/")},
  {id:"experiments",label:"Experiment records",match:p=>p.startsWith("docs/experiments/")},
  {id:"models",label:"Method / model records",match:p=>p.startsWith("docs/models/")},
  {id:"openspec",label:"OpenSpec research contracts",match:p=>p.startsWith("openspec/")},
  {id:"implementation",label:"Method implementation",match:p=>p.startsWith("digital_twin/")},
  {id:"scripts",label:"Research scripts",match:p=>p.startsWith("scripts/")},
  {id:"tests",label:"Verification code",match:p=>p.startsWith("tests/")}
]);
function familyOf(file){return FAMILIES.find(x=>x.match(file))??{id:"other",label:"Other research sources"}}
function shortHash(value){return crypto.createHash("sha1").update(value).digest("hex").slice(0,14)}
function claimIdOf(mapping){
  if(mapping.entityType==="claim")return mapping.entityId;
  if(mapping.entityType==="evidence")return mapping.claimId??null;
  return mapping.claimId??null;
}
export function buildGeneratedSourceLayer({knowledge=loadKnowledge(),index=loadSourceIndex()}={}){
  if(!index.rootPresent||!(index.fileRecords??[]).length)return Object.freeze({schemaVersion:1,generatedAt:new Date().toISOString(),sourceIndexed:false,areas:[],artifacts:[]});
  const files=index.fileRecords.map(x=>x.path);
  const mapped=mapSourceFilesToEntities(files,{knowledge,index});
  const recordByPath=new Map(index.fileRecords.map(x=>[x.path,x]));
  const areas=new Map(),artifacts=[];
  const seen=new Set();
  for(const fileMap of mapped){
    const record=recordByPath.get(fileMap.file);if(!record)continue;
    for(const mapping of fileMap.mappings){
      const claimId=claimIdOf(mapping);
      if(!claimId||!knowledge.claimById.has(claimId)||Number(mapping.confidence??0)<.65)continue;
      const key=claimId+"\0"+fileMap.file;if(seen.has(key))continue;seen.add(key);
      const family=familyOf(fileMap.file);
      const areaId="source-area:"+claimId+":"+family.id;
      const artifactId="artifact:"+claimId+":"+shortHash(fileMap.file);
      artifacts.push({
        id:artifactId,sourceId:"source:thesis:"+fileMap.file,claimId,areaId,
        title:path.posix.basename(fileMap.file),path:fileMap.file,family:family.id,
        sha256:record.sha256??null,chunkCount:Number(record.chunkCount??0),
        mappingConfidence:Number(mapping.confidence??0),mappingReason:mapping.reason??fileMap.mappingMode,
        summary:"Indexed thesis source · "+family.label+" · provenance only; does not create a new Claim."
      });
      if(!areas.has(areaId))areas.set(areaId,{
        id:areaId,claimId,family:family.id,title:family.label,
        summary:"Generated source-detail area derived from the canonical thesis index. Expanding it reveals indexed source artifacts.",
        artifactIds:[]
      });
      areas.get(areaId).artifactIds.push(artifactId);
    }
  }
  const areaList=[...areas.values()].map(area=>({...area,artifactIds:[...new Set(area.artifactIds)].sort()})).sort((a,b)=>a.claimId.localeCompare(b.claimId)||a.family.localeCompare(b.family));
  artifacts.sort((a,b)=>a.claimId.localeCompare(b.claimId)||a.path.localeCompare(b.path));
  return Object.freeze({schemaVersion:1,generatedAt:new Date().toISOString(),sourceIndexed:true,areas:areaList,artifacts});
}
