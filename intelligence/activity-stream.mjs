import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./research-knowledge.mjs";
import { appendReplayEvent } from "./research-replay.mjs";

const activityPath = path.join(workspaceRoot, ".research-index", "activity.json");
const allowedTypes = new Set([
  "prompt_submitted","orchestration_planned","source_read","source_indexed",
  "claim_changed","evidence_changed","citation_changed","research_change",
  "artifact_changed","dependency_changed","commit","pull_request","review",
  "verification_started","verification_passed","verification_failed","checkpoint",
  "task_started","task_completed","task_failed"
]);

function read() {
  if (!fs.existsSync(activityPath)) return { schemaVersion:1, events:[] };
  return JSON.parse(fs.readFileSync(activityPath, "utf8"));
}
function write(data) {
  fs.mkdirSync(path.dirname(activityPath), { recursive:true });
  data.events = data.events.slice(-10000);
  fs.writeFileSync(activityPath, JSON.stringify(data, null, 2));
}

export function activityEvents({ after = 0, limit = 200 } = {}) {
  return read().events.filter((x) => x.sequence > after).slice(0, limit);
}

export function emitActivity(event) {
  if (!allowedTypes.has(event.type)) throw new Error(`Unsupported activity type: ${event.type}`);
  const data = read();
  const sequence = (data.events.at(-1)?.sequence ?? 0) + 1;
  const next = Object.freeze({ sequence, at:new Date().toISOString(), ...event });
  data.events.push(next);
  write(data);
  appendReplayEvent({ kind:"activity", activity:next });
  return next;
}
