import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { workspaceRoot } from "./research-knowledge.mjs";

const TEXT_EXTENSIONS = new Set([".md",".txt",".json",".bib",".ris",".csv",".tex",".py",".mjs",".js",".yaml",".yml"]);
const INDEX_DIR = path.join(workspaceRoot, ".research-index");
const INDEX_PATH = path.join(INDEX_DIR, "source-index.json");

export function thesisRoot() {
  return path.resolve(process.env.RESEARCH_THESIS_REPO || path.join(workspaceRoot, "..", "Three-Factor-Digital-Twin"));
}

function walk(root, current = root, out = []) {
  if (!fs.existsSync(current)) return out;
  for (const entry of fs.readdirSync(current, { withFileTypes:true })) {
    if ([".git","outputs",".venv","__pycache__","node_modules"].includes(entry.name)) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walk(root, full, out);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function chunksForFile(root, file, chunkLines = 120, overlap = 20) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const relativePath = path.relative(root, file).split(path.sep).join("/");
  const chunks = [];
  const step = Math.max(1, chunkLines - overlap);
  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(lines.length, start + chunkLines);
    const body = lines.slice(start, end).join("\n");
    if (!body.trim()) continue;
    chunks.push({
      id:`source:thesis:${relativePath}:${start + 1}-${end}`,
      repository:"Yunitrish006006/Three-Factor-Digital-Twin",
      path:relativePath,
      startLine:start + 1,
      endLine:end,
      sha256:hash(body),
      text:body
    });
    if (end === lines.length) break;
  }
  return chunks;
}

export function buildSourceIndex({ root = thesisRoot() } = {}) {
  const present = fs.existsSync(root);
  const chunks = present ? walk(root).flatMap((file) => chunksForFile(root, file)) : [];
  const index = {
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    repository:"Yunitrish006006/Three-Factor-Digital-Twin",
    rootPresent:present,
    files:present ? [...new Set(chunks.map((x) => x.path))].length : 0,
    chunks
  };
  fs.mkdirSync(INDEX_DIR, { recursive:true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  return index;
}

export function loadSourceIndex() {
  return fs.existsSync(INDEX_PATH) ? JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) : buildSourceIndex();
}

export function searchSources(query, { limit = 12, index = loadSourceIndex() } = {}) {
  const tokens = String(query).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((x) => x.length > 1);
  const results = index.chunks.map((chunk) => {
    const haystack = `${chunk.path}\n${chunk.text}`.toLowerCase();
    const score = tokens.reduce((n, token) => n + (haystack.includes(token) ? 1 : 0), 0);
    return { ...chunk, score };
  }).filter((x) => x.score > 0).sort((a,b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
  return { query, results, freshness:{ rootPresent:index.rootPresent, generatedAt:index.generatedAt } };
}
