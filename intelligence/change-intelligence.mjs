import fs from "node:fs";
import path from "node:path";
import { impactAnalysis, loadKnowledge, workspaceRoot } from "./research-knowledge.mjs";
import { repositoryStatusSummary } from "./repository-status.mjs";

const statePath=path.join(workspaceRoot,".research-index","change-intelligence.json");

export function semanticSnapshot(knowledge = loadKnowledge()) {
  return Object.freeze({
    generatedAt:new Date().toISOString(),
    entityIds:[
      knowledge.root.id,
      ...knowledge.topics.map((x) => x.id),
      ...knowledge.claims.map((x) => x.id),
      ...knowledge.studies.map((x) => x.id),
      ...knowledge.evidence.map((x) => x.id),
      ...knowledge.reviews.map((x) => x.id)
    ].sort(),
    relationIds:knowledge.relations.map((x) => x.id).sort()
  });
}

export function diffSnapshots(before, after) {
  const beforeEntities = new Set(before?.entityIds ?? []);
  const afterEntities = new Set(after?.entityIds ?? []);
  const beforeRelations = new Set(before?.relationIds ?? []);
  const afterRelations = new Set(after?.relationIds ?? []);
  return Object.freeze({
    addedEntityIds:[...afterEntities].filter((x) => !beforeEntities.has(x)),
    removedEntityIds:[...beforeEntities].filter((x) => !afterEntities.has(x)),
    addedRelationIds:[...afterRelations].filter((x) => !beforeRelations.has(x)),
    removedRelationIds:[...beforeRelations].filter((x) => !afterRelations.has(x))
  });
}

export function loadResearchChangeIntelligence() {
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath,"utf8"));
}

export function researchChangeIntelligence({ changedFiles = null, changedTopics = [], before = null, knowledge = loadKnowledge(), persist = false } = {}) {
  const repositoryStatus=repositoryStatusSummary({knowledge});
  const thesis=repositoryStatus.repositories.find((x)=>x.id==="thesis");
  const effectiveFiles=changedFiles?.length ? changedFiles : (thesis?.changedFiles ?? []);
  const after = semanticSnapshot(knowledge);
  const previousSnapshot=before ?? loadResearchChangeIntelligence()?.snapshot ?? null;
  const semanticDiff = previousSnapshot ? diffSnapshots(previousSnapshot, after) : { addedEntityIds:[],removedEntityIds:[],addedRelationIds:[],removedRelationIds:[] };
  const impact = impactAnalysis({ changedFiles:effectiveFiles, changedTopics }, knowledge);
  const result={
    generatedAt:new Date().toISOString(),
    changedFiles:effectiveFiles,
    semanticDiff,
    changedEntityIds:[...new Set([...semanticDiff.addedEntityIds, ...semanticDiff.removedEntityIds, ...impact.directClaimIds])],
    impactedClaimIds:impact.impactedClaimIds,
    impactedTopicIds:impact.impactedTopicIds,
    repositoryStatus,
    snapshot:after
  };
  if(persist){
    fs.mkdirSync(path.dirname(statePath),{recursive:true});
    fs.writeFileSync(statePath,JSON.stringify(result,null,2));
  }
  return Object.freeze(result);
}
