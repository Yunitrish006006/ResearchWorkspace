import { impactAnalysis, loadKnowledge } from "./research-knowledge.mjs";

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

export function researchChangeIntelligence({ changedFiles = [], changedTopics = [], before = null, knowledge = loadKnowledge() } = {}) {
  const after = semanticSnapshot(knowledge);
  const semanticDiff = before ? diffSnapshots(before, after) : { addedEntityIds:[],removedEntityIds:[],addedRelationIds:[],removedRelationIds:[] };
  const impact = impactAnalysis({ changedFiles, changedTopics }, knowledge);
  return Object.freeze({
    generatedAt:new Date().toISOString(),
    changedFiles,
    semanticDiff,
    changedEntityIds:[...new Set([...semanticDiff.addedEntityIds, ...semanticDiff.removedEntityIds, ...impact.directClaimIds])],
    impactedClaimIds:impact.impactedClaimIds,
    impactedTopicIds:impact.impactedTopicIds,
    snapshot:after
  });
}
