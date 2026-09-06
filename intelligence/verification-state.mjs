import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./research-knowledge.mjs";

const file = path.join(workspaceRoot, ".research-index", "verification-state.json");

export function foldVerificationEvents(events = []) {
  const latest = new Map();
  for (const event of events) {
    if (!event.targetId) continue;
    latest.set(event.targetId, event);
  }
  return Object.freeze({
    latest:[...latest.values()],
    runningTargetIds:[...latest.values()].filter((x) => x.type === "verification_started").map((x) => x.targetId),
    passedTargetIds:[...latest.values()].filter((x) => x.type === "verification_passed").map((x) => x.targetId),
    failedTargetIds:[...latest.values()].filter((x) => x.type === "verification_failed").map((x) => x.targetId)
  });
}

export function loadVerificationState() {
  if (!fs.existsSync(file)) return foldVerificationEvents([]);
  return foldVerificationEvents(JSON.parse(fs.readFileSync(file, "utf8")).events ?? []);
}

export function appendVerificationEvent(event) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { events:[] };
  existing.events.push({ sequence:existing.events.length + 1, at:new Date().toISOString(), ...event });
  existing.events = existing.events.slice(-10000);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
  return foldVerificationEvents(existing.events);
}
