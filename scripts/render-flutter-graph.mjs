import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraphViewModel } from "../intelligence/graph-view-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "viewer_flutter", "assets", "graph-data.json");
const model = buildGraphViewModel();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(model, null, 2) + "\n");
console.log(JSON.stringify({ output: path.relative(root, out), topics: model.topics.length, claims: model.claims.length }, null, 2));
