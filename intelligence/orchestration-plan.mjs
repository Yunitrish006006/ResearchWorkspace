import { loadKnowledge, resolveTask, impactAnalysis } from "./research-knowledge.mjs";

export const MAX_SUBAGENTS = 4;
export const MAX_PARALLEL_EXTRACTORS = 2;

const modes = Object.freeze([
  { max: 2, mode: "primary-only" },
  { max: 5, mode: "assisted" },
  { max: 9, mode: "bounded-parallel" },
  { max: Infinity, mode: "guarded-parallel" }
]);

export function buildOrchestrationPlan({
  query,
  topicId = null,
  claimId = null,
  changedTopics = [],
  changedFiles = [],
  knowledge = loadKnowledge()
}) {
  const resolution = resolveTask(query, knowledge);
  const impact = impactAnalysis({ changedFiles, changedTopics }, knowledge);
  const topics = [...new Set([
    ...(topicId ? [topicId] : []),
    ...resolution.topics.map((x) => x.id),
    ...impact.impactedTopicIds
  ])].filter((id) => knowledge.topicById.has(id));

  const claims = [...new Set([
    ...(claimId ? [claimId] : []),
    ...resolution.claims,
    ...impact.impactedClaimIds
  ])].filter((id) => knowledge.claimById.has(id));

  const evidenceBreadth = knowledge.evidence.filter((x) => claims.includes(x.claimId)).length;
  const relationSurface = knowledge.relations.filter((x) => claims.includes(x.from) || claims.includes(x.to)).length;
  const verificationBreadth = knowledge.verificationChecks.filter((x) => x.claimIds.some((id) => claims.includes(id))).length;
  const highRisk = /causal|control|intervention|因果|控制|介入/i.test(query) ? 2 : 0;
  const routingUncertainty = resolution.topics.every((x) => x.score === 0) ? 2 : 0;
  const score = Math.min(20,
    Math.max(0, topics.length - 1) * 2 +
    Math.min(4, evidenceBreadth) +
    Math.min(3, relationSurface) +
    Math.min(3, verificationBreadth) +
    highRisk +
    routingUncertainty
  );

  const mode = modes.find((x) => score <= x.max).mode;
  const assignments = [];
  if (mode !== "primary-only") {
    assignments.push({ role:"literature-scout", access:"read-only", scope:topics.slice(0, 3), wave:"discovery" });
  }
  if (mode === "guarded-parallel") {
    assignments.unshift({ role:"methodology-analyst", access:"read-only", scope:topics.slice(0, 3), wave:"discovery" });
  }
  if (["bounded-parallel","guarded-parallel"].includes(mode)) {
    for (const topic of topics.slice(0, MAX_PARALLEL_EXTRACTORS)) {
      assignments.push({ role:"evidence-extractor", access:"write-one-topic", scope:[topic], wave:"extraction" });
    }
  }
  if (mode !== "primary-only") {
    assignments.push({ role:"independent-reviewer", access:"read-only", scope:topics.slice(0, 3), wave:"review" });
  }

  return Object.freeze({
    query,
    score,
    mode,
    topics,
    claims,
    assignments: assignments.slice(0, MAX_SUBAGENTS),
    waves:["discovery","extraction","review"].filter((wave) => assignments.some((x) => x.wave === wave)),
    constraints:{
      maxSubagents:MAX_SUBAGENTS,
      maxParallelEvidenceExtractors:MAX_PARALLEL_EXTRACTORS,
      primaryFallback:"Execute the same waves sequentially when multi-agent execution is unavailable."
    }
  });
}
