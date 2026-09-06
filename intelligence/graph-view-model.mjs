import { loadKnowledge } from "./research-knowledge.mjs";
import { buildVerificationGraph } from "./verification-graph.mjs";

export function buildGraphViewModel(knowledge = loadKnowledge()) {
  const verification = buildVerificationGraph(knowledge);
  return Object.freeze({
    schemaVersion:1,
    snapshot:{
      date:knowledge.snapshot.date,
      thesisRepo:knowledge.snapshot.thesisRepository,
      thesisCommit:knowledge.snapshot.thesisCommit,
      referenceRepo:knowledge.snapshot.referenceRepository,
      referenceCommit:knowledge.snapshot.referenceCommit
    },
    root:knowledge.root,
    topics:knowledge.topics,
    claims:knowledge.claims,
    studies:knowledge.studies,
    evidence:knowledge.evidence,
    reviews:knowledge.reviews,
    relations:knowledge.relations,
    verification
  });
}
