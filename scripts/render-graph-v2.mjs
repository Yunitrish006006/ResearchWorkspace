import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraphViewModel } from "../intelligence/graph-view-model.mjs";
import { loadKnowledge } from "../intelligence/research-knowledge.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export function renderGraphV2({ knowledge = loadKnowledge() } = {}) {
  const model = buildGraphViewModel(knowledge);
  const out = path.join(root, "site", "generated", "graph-data.js");
  fs.mkdirSync(path.dirname(out), { recursive:true });
  fs.writeFileSync(out, `window.__RESEARCH_GRAPH_DATA__ = ${JSON.stringify(model, null, 2)};\n`);
  return Object.freeze({
    output:path.relative(root, out),
    generatedAt:new Date().toISOString(),
    topics:model.topics.length,
    claims:model.claims.length,
    evidence:model.evidence.length,
    reviews:model.reviews.length
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(renderGraphV2(), null, 2));
}
