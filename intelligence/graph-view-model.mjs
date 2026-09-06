import { loadKnowledge } from "./research-knowledge.mjs";
import { buildVerificationGraph } from "./verification-graph.mjs";
import { repositoryStatusSummary } from "./repository-status.mjs";

export function buildGraphViewModel(knowledge = loadKnowledge()) {
  const verification = buildVerificationGraph(knowledge);
  const repositories = repositoryStatusSummary({ knowledge });
  const thesis = repositories.repositories.find((entry) => entry.id === "thesis");
  const effectiveThesisCommit = thesis?.head || knowledge.snapshot.thesisCommit;
  return Object.freeze({
    schemaVersion:2,
    snapshot:{
      date:knowledge.snapshot.date,
      thesisRepo:knowledge.snapshot.thesisRepository,
      thesisCommit:effectiveThesisCommit,
      auditedThesisCommit:knowledge.snapshot.thesisCommit,
      thesisSnapshotDrift:Boolean(thesis?.head && thesis.head !== knowledge.snapshot.thesisCommit),
      thesisDirty:thesis?.dirty === true,
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
