import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./research-knowledge.mjs";

const replayPath = path.join(workspaceRoot, ".research-index", "research-replay.json");

function loadRaw() {
  if (!fs.existsSync(replayPath)) return { schemaVersion:1, events:[], checkpoints:[] };
  return JSON.parse(fs.readFileSync(replayPath, "utf8"));
}
function saveRaw(data) {
  fs.mkdirSync(path.dirname(replayPath), { recursive:true });
  data.events = data.events.slice(-10000);
  data.checkpoints = data.checkpoints.slice(-1200);
  fs.writeFileSync(replayPath, JSON.stringify(data, null, 2));
}

export function appendReplayEvent(event) {
  const data = loadRaw();
  const sequence = (data.events.at(-1)?.sequence ?? 0) + 1;
  const next = { sequence, at:new Date().toISOString(), ...event };
  data.events.push(next);
  saveRaw(data);
  return next;
}

export function appendReplayCheckpoint(checkpoint) {
  const data = loadRaw();
  const sequence = data.events.at(-1)?.sequence ?? 0;
  data.checkpoints.push({ sequence, at:new Date().toISOString(), ...checkpoint });
  saveRaw(data);
  return data.checkpoints.at(-1);
}

export function replayTimeline() {
  const data = loadRaw();
  return Object.freeze({
    earliestSequence:data.events[0]?.sequence ?? 0,
    latestSequence:data.events.at(-1)?.sequence ?? 0,
    eventCount:data.events.length,
    checkpointCount:data.checkpoints.length,
    events:data.events,
    checkpoints:data.checkpoints
  });
}

export function replayFrame(sequence) {
  const data = loadRaw();
  const latest = data.events.at(-1)?.sequence ?? 0;
  const target = Math.max(0, Math.min(Number(sequence) || 0, latest));
  const events = data.events.filter((x) => x.sequence <= target);
  const checkpoint = [...data.checkpoints].reverse().find((x) => x.sequence <= target) ?? null;
  return Object.freeze({ sequence:target, live:target >= latest, checkpoint, events });
}
