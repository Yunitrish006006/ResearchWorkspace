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
  "task_started","task_completed","task_failed","thread_started","turn_started",
  "usage_updated","agent_message","file_edit","tool_started","tool_completed",
  "dependency_followed","command_started","command_completed",
  "web_search_started","web_search_completed","todo_updated",
  "commit_created","pr_created","pr_merged",
  "deployment_started","deployment_completed","deployment_failed"
]);

function read() {
  if (!fs.existsSync(activityPath)) return { schemaVersion:2, latestSequence:0, events:[] };
  try {
    const parsed=JSON.parse(fs.readFileSync(activityPath,"utf8"));
    return {
      schemaVersion:2,
      latestSequence:Number(parsed.latestSequence ?? parsed.events?.at(-1)?.sequence ?? 0),
      events:Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch {
    return { schemaVersion:2, latestSequence:0, events:[] };
  }
}
function write(data) {
  fs.mkdirSync(path.dirname(activityPath), { recursive:true });
  data.events=data.events.slice(-10000);
  fs.writeFileSync(activityPath, JSON.stringify(data, null, 2)+"\n");
}

export function activityEvents({ after = 0, limit = 200 } = {}) {
  const count=Math.max(1,Math.min(1000,Math.floor(Number(limit)||200)));
  return read().events.filter((x)=>x.sequence>Number(after||0)).slice(0,count);
}
export function activityStatus() {
  const data=read();
  return Object.freeze({schemaVersion:2,latestSequence:data.latestSequence,eventCount:data.events.length,lastEvent:data.events.at(-1)??null});
}
export function emitActivity(event) {
  if (!allowedTypes.has(event.type)) throw new Error("Unsupported activity type: "+event.type);
  const data=read();
  const sequence=Math.max(data.latestSequence,Number(data.events.at(-1)?.sequence ?? 0))+1;
  const timestamp=new Date().toISOString();
  const next=Object.freeze({sequence,timestamp,at:timestamp,...event});
  data.latestSequence=sequence;
  data.events.push(next);
  write(data);
  appendReplayEvent(next);
  return next;
}
