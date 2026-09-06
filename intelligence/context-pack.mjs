import { loadKnowledge, resolveTask, graphForTopic } from "./research-knowledge.mjs";
import { buildOrchestrationPlan } from "./orchestration-plan.mjs";
import { searchSources } from "./source-index.mjs";

const aliases = Object.freeze({
  primary:"research-synthesizer",
  explorer:"literature-scout",
  architect:"methodology-analyst",
  worker:"evidence-extractor",
  reviewer:"independent-reviewer"
});

const audiences = new Set([
  "research-synthesizer","literature-scout","methodology-analyst","evidence-extractor","independent-reviewer"
]);

function normalizeAudience(value) {
  const mapped = aliases[value] || value || "research-synthesizer";
  if (!audiences.has(mapped)) throw new Error(`Unknown audience: ${value}`);
  return mapped;
}

export function buildContextPack(query, {
  audience = "research-synthesizer",
  topicId = null,
  maxTokens = 8000,
  includeSources = true,
  knowledge = loadKnowledge()
} = {}) {
  const role = normalizeAudience(audience);
  const resolution = resolveTask(query, knowledge);
  const plan = buildOrchestrationPlan({ query, topicId, knowledge });
  const selectedTopics = topicId ? [topicId] : resolution.topics.map((x) => x.id).slice(0, role === "evidence-extractor" ? 1 : 3);
  const graphs = selectedTopics.map((id) => graphForTopic(id, { depth:2, knowledge }));
  const sourceSearch = includeSources ? searchSources(query, { limit: role === "literature-scout" ? 16 : 10 }) : { results:[] };

  return Object.freeze({
    query,
    audience:role,
    maxTokens,
    orchestration:{ score:plan.score, mode:plan.mode, assignments:plan.assignments },
    scope:{ topics:selectedTopics, writeScope:role === "evidence-extractor" ? selectedTopics.slice(0,1) : [] },
    graph:graphs,
    sources:sourceSearch.results.map((x) => ({
      id:x.id, repository:x.repository, path:x.path, startLine:x.startLine, endLine:x.endLine, sha256:x.sha256,
      excerpt:x.text.slice(0, 1800)
    })),
    constraints:{
      readOnly:["literature-scout","methodology-analyst","independent-reviewer"].includes(role),
      evidenceBoundary:"Do not merge synthetic, real target-point, public benchmark, or intervention evidence classes."
    }
  });
}
