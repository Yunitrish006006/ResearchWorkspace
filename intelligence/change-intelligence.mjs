import fs from "node:fs";
import path from "node:path";
import { impactAnalysis, loadKnowledge, workspaceRoot } from "./research-knowledge.mjs";
import { repositoryStatusSummary } from "./repository-status.mjs";
import { loadSourceIndex, refreshSourceIndex } from "./source-index.mjs";
import { mappedImpactSurface } from "./source-mapping.mjs";

const statePath=path.join(workspaceRoot,".research-index","change-intelligence.json");

export function semanticSnapshot(knowledge=loadKnowledge()){
  return Object.freeze({
    generatedAt:new Date().toISOString(),
    entityIds:[knowledge.root.id,...knowledge.topics.map(x=>x.id),...knowledge.claims.map(x=>x.id),...knowledge.studies.map(x=>x.id),...knowledge.evidence.map(x=>x.id),...knowledge.reviews.map(x=>x.id)].sort(),
    relationIds:knowledge.relations.map(x=>x.id).sort()
  });
}
export function diffSnapshots(before,after){
  const be=new Set(before?.entityIds??[]),ae=new Set(after?.entityIds??[]),br=new Set(before?.relationIds??[]),ar=new Set(after?.relationIds??[]);
  return Object.freeze({
    addedEntityIds:[...ae].filter(x=>!be.has(x)),removedEntityIds:[...be].filter(x=>!ae.has(x)),
    addedRelationIds:[...ar].filter(x=>!br.has(x)),removedRelationIds:[...br].filter(x=>!ar.has(x))
  });
}
export function loadResearchChangeIntelligence(){
  if(!fs.existsSync(statePath))return null;
  try{return JSON.parse(fs.readFileSync(statePath,"utf8"))}catch{return null}
}
export function researchChangeIntelligence({changedFiles=null,changedTopics=[],before=null,knowledge=loadKnowledge(),persist=false,refreshIndex=true}={}){
  const repositoryStatus=repositoryStatusSummary({knowledge});
  const thesis=repositoryStatus.repositories.find(x=>x.id==="thesis");
  const effectiveFiles=changedFiles?.length?changedFiles:(thesis?.changedFiles??[]);
  let index=loadSourceIndex(),indexRefresh={mode:"fresh",refreshedFiles:[],removedFiles:[]};
  if(refreshIndex&&effectiveFiles.length){
    const refreshed=refreshSourceIndex({files:effectiveFiles,index});
    index=refreshed.index;indexRefresh={mode:refreshed.mode,refreshedFiles:refreshed.refreshedFiles,removedFiles:refreshed.removedFiles};
  }
  const sourceMapping=mappedImpactSurface(effectiveFiles,{knowledge,index});
  const mappedClaims=sourceMapping.claimIds;
  const mappedTopics=[...new Set([...changedTopics,...sourceMapping.topicIds])];
  const after=semanticSnapshot(knowledge),previous=before??loadResearchChangeIntelligence()?.snapshot??null;
  const semanticDiff=previous?diffSnapshots(previous,after):{addedEntityIds:[],removedEntityIds:[],addedRelationIds:[],removedRelationIds:[]};
  const directImpact=impactAnalysis({changedFiles:effectiveFiles,changedTopics:mappedTopics},knowledge);
  const impactedClaims=new Set([...directImpact.impactedClaimIds,...mappedClaims]);
  let propagated=true;
  while(propagated){
    propagated=false;
    for(const rel of knowledge.relations){
      if((impactedClaims.has(rel.from)||impactedClaims.has(rel.to))&&!(impactedClaims.has(rel.from)&&impactedClaims.has(rel.to))){
        const candidate=impactedClaims.has(rel.from)?rel.to:rel.from;
        if(knowledge.claimById.has(candidate)){impactedClaims.add(candidate);propagated=true}
      }
    }
  }
  const impactedTopicIds=[...new Set([...mappedTopics,...[...impactedClaims].map(id=>knowledge.claimById.get(id)?.ownerId).filter(Boolean)])];
  const result={
    generatedAt:new Date().toISOString(),changedFiles:effectiveFiles,indexRefresh,sourceMapping,
    semanticDiff,
    changedEntityIds:[...new Set([...semanticDiff.addedEntityIds,...semanticDiff.removedEntityIds,...sourceMapping.entityIds,...directImpact.directClaimIds])],
    directlyMappedClaimIds:mappedClaims,impactedClaimIds:[...impactedClaims],impactedTopicIds,
    repositoryStatus,snapshot:after
  };
  if(persist){fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify(result,null,2)+"\n")}
  return Object.freeze(result);
}
