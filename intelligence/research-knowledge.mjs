import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = path.resolve(here, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8"));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function loadKnowledge() {
  const graph = readJson("data/research-graph.json");
  const repositories = readJson("data/repositories.json");
  const verification = readJson("data/verification-matrix.json");
  const topicIds = new Set(graph.topics.map((x) => x.id));
  const claimIds = new Set(graph.claims.map((x) => x.id));
  const nodeIds = new Set([
    graph.root.id,
    ...graph.topics.map((x) => x.id),
    ...graph.claims.map((x) => x.id),
    ...graph.studies.map((x) => x.id),
    ...graph.evidence.map((x) => x.id),
    ...graph.reviews.map((x) => x.id)
  ]);

  for (const claim of graph.claims) {
    if (!topicIds.has(claim.ownerId)) throw new Error(`Claim ${claim.id} references missing topic ${claim.ownerId}`);
  }
  for (const item of [...graph.studies, ...graph.evidence, ...graph.reviews]) {
    if (!claimIds.has(item.claimId)) throw new Error(`${item.id} references missing claim ${item.claimId}`);
  }
  for (const relation of graph.relations) {
    if (!nodeIds.has(relation.from) || !nodeIds.has(relation.to)) {
      throw new Error(`Relation ${relation.id} has unresolved endpoint`);
    }
  }

  return Object.freeze({
    root: workspaceRoot,
    ...graph,
    repositories: repositories.repositories,
    verificationChecks: verification.checks,
    topicById: new Map(graph.topics.map((x) => [x.id, x])),
    claimById: new Map(graph.claims.map((x) => [x.id, x])),
    nodeIds
  });
}

export function knowledgeSummary(knowledge = loadKnowledge()) {
  return Object.freeze({
    snapshot: knowledge.snapshot,
    topics: knowledge.topics.length,
    claims: knowledge.claims.length,
    studies: knowledge.studies.length,
    evidence: knowledge.evidence.length,
    reviews: knowledge.reviews.length,
    relations: knowledge.relations.length,
    verificationChecks: knowledge.verificationChecks.length,
    repositories: knowledge.repositories.length
  });
}

function textScore(query, values) {
  const tokens = String(query).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((x) => x.length > 1);
  const haystack = values.join(" ").toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export function resolveTask(query, knowledge = loadKnowledge()) {
  const rankedTopics = knowledge.topics.map((topic) => {
    const claims = knowledge.claims.filter((claim) => claim.ownerId === topic.id);
    return {
      id: topic.id,
      name: topic.name,
      score: textScore(query, [topic.id, topic.name, topic.summary, ...claims.flatMap((c) => [c.title, c.summary])]),
      claimIds: claims.map((c) => c.id)
    };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const selected = rankedTopics.filter((x) => x.score > 0);
  const fallback = selected.length ? selected : rankedTopics.slice(0, 2);
  return Object.freeze({
    query,
    topics: fallback.slice(0, 5),
    claims: unique(fallback.flatMap((topic) => topic.claimIds)),
    risks: [
      ...(String(query).match(/control|causal|控制|因果/i) ? ["intervention-evidence-boundary"] : []),
      ...(String(query).match(/public|CU-BEMS|SML2010|公開/i) ? ["public-benchmark-not-dense-3d-ground-truth"] : [])
    ]
  });
}

export function graphForTopic(topicId, { depth = 2, knowledge = loadKnowledge() } = {}) {
  const topic = knowledge.topicById.get(topicId);
  if (!topic) throw new Error(`Unknown topic: ${topicId}`);
  const claims = knowledge.claims.filter((x) => x.ownerId === topicId);
  const claimIds = new Set(claims.map((x) => x.id));
  return Object.freeze({
    topic,
    claims,
    studies: depth >= 2 ? knowledge.studies.filter((x) => claimIds.has(x.claimId)) : [],
    evidence: depth >= 2 ? knowledge.evidence.filter((x) => claimIds.has(x.claimId)) : [],
    reviews: depth >= 2 ? knowledge.reviews.filter((x) => claimIds.has(x.claimId)) : [],
    relations: knowledge.relations.filter((x) => claimIds.has(x.from) || claimIds.has(x.to))
  });
}

export function impactAnalysis({ changedFiles = [], changedTopics = [] } = {}, knowledge = loadKnowledge()) {
  const directClaims = new Set();
  for (const file of changedFiles) {
    for (const claim of knowledge.claims) {
      if ((claim.sources ?? []).some((source) => file === source || file.endsWith(source) || source.endsWith(file))) {
        directClaims.add(claim.id);
      }
    }
    for (const evidence of knowledge.evidence) {
      if (file === evidence.path || file.startsWith(evidence.path) || evidence.path.startsWith(file)) {
        directClaims.add(evidence.claimId);
      }
    }
  }
  for (const topicId of changedTopics) {
    for (const claim of knowledge.claims.filter((x) => x.ownerId === topicId)) directClaims.add(claim.id);
  }

  const impacted = new Set(directClaims);
  let changed = true;
  while (changed) {
    changed = false;
    for (const rel of knowledge.relations) {
      if ((impacted.has(rel.from) || impacted.has(rel.to)) && !(impacted.has(rel.from) && impacted.has(rel.to))) {
        const candidate = impacted.has(rel.from) ? rel.to : rel.from;
        if (knowledge.claimById.has(candidate)) {
          impacted.add(candidate);
          changed = true;
        }
      }
    }
  }
  const impactedTopics = unique([...impacted].map((id) => knowledge.claimById.get(id)?.ownerId));
  return Object.freeze({
    changedFiles,
    directClaimIds: [...directClaims],
    impactedClaimIds: [...impacted],
    impactedTopicIds: impactedTopics
  });
}

export function verificationPlan({ query = "", changedTopics = [], changedFiles = [] } = {}, knowledge = loadKnowledge()) {
  const impact = impactAnalysis({ changedFiles, changedTopics }, knowledge);
  const checks = knowledge.verificationChecks.filter((check) =>
    check.claimIds.some((claimId) => impact.impactedClaimIds.includes(claimId))
  );
  const fallback = checks.length ? checks : knowledge.verificationChecks.filter((x) => ["E1","E6","E7","E9"].includes(x.id));
  return Object.freeze({
    query,
    impact,
    checks: fallback,
    requiredCategories: unique(fallback.map((x) => x.evidenceClass))
  });
}
