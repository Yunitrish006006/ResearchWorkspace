import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./research-knowledge.mjs";

const SCHEMA_VERSION = 2;
const EVENT_LIMIT = 10000;
const SESSION_LIMIT = 250;
const CHECKPOINT_LIMIT = 1200;
const replayPath = path.join(workspaceRoot, ".research-index", "research-replay.json");
const MILESTONE_TYPES = new Set(["commit_created","pr_created","pr_merged","deployment_started","deployment_completed","deployment_failed"]);
const TERMINAL_TASK_TYPES = new Set(["task_completed","task_failed"]);
const VERIFICATION_STATUS = Object.freeze({
  verification_started:"running",
  verification_passed:"passed",
  verification_failed:"failed"
});

function emptyReplay() {
  return { schemaVersion:SCHEMA_VERSION, updatedAt:null, latestSequence:0, events:[], sessions:[], checkpoints:[] };
}
function cloneJson(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}
function normalizeReplay(parsed) {
  if (!parsed || !Array.isArray(parsed.events)) return emptyReplay();
  return {
    schemaVersion:SCHEMA_VERSION,
    updatedAt:typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    latestSequence:Number.isFinite(parsed.latestSequence) ? Math.max(0, Math.floor(parsed.latestSequence)) : Number(parsed.events.at(-1)?.sequence ?? 0),
    events:parsed.events,
    sessions:Array.isArray(parsed.sessions) ? parsed.sessions : [],
    checkpoints:Array.isArray(parsed.checkpoints) ? parsed.checkpoints : []
  };
}
export function loadResearchReplay() {
  try { return normalizeReplay(JSON.parse(fs.readFileSync(replayPath, "utf8"))); }
  catch { return emptyReplay(); }
}
function saveResearchReplay(state) {
  fs.mkdirSync(path.dirname(replayPath), { recursive:true });
  const temp = replayPath + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(state, null, 2) + "\n", "utf8");
  fs.renameSync(temp, replayPath);
}
function sessionIdForTask(taskId) { return taskId ? "session:" + taskId : null; }
function findSession(state, event) {
  if (event.taskId) {
    const id=sessionIdForTask(event.taskId);
    return state.sessions.find((x)=>x.id===id) ?? null;
  }
  return [...state.sessions].reverse().find((x)=>x.state==="running") ?? null;
}
function ensureTaskSession(state, event) {
  if (!event.taskId) return findSession(state,event);
  const id=sessionIdForTask(event.taskId);
  let session=state.sessions.find((x)=>x.id===id);
  if (!session) {
    session={
      id, taskId:event.taskId, state:"running",
      startedSequence:event.sequence, endedSequence:null,
      startedAt:event.timestamp ?? event.at ?? new Date().toISOString(), endedAt:null,
      topicId:event.topicId ?? null, claimId:event.claimId ?? null,
      summary:event.summary ?? null, eventCount:0, milestoneCount:0
    };
    state.sessions.push(session);
  }
  return session;
}

export function appendReplayEvent(event) {
  const state=loadResearchReplay();
  const stored=cloneJson(event);
  const session=event.type==="task_started" ? ensureTaskSession(state,event) : findSession(state,event);
  if (session) {
    stored.sessionId=session.id;
    session.eventCount=Number(session.eventCount ?? 0)+1;
    if (!session.topicId && event.topicId) session.topicId=event.topicId;
    if (!session.claimId && event.claimId) session.claimId=event.claimId;
    if (MILESTONE_TYPES.has(event.type)) session.milestoneCount=Number(session.milestoneCount ?? 0)+1;
    if (TERMINAL_TASK_TYPES.has(event.type)) {
      session.state=event.type==="task_completed" ? "completed" : "failed";
      session.endedSequence=event.sequence;
      session.endedAt=event.timestamp ?? event.at ?? new Date().toISOString();
    }
  }
  state.latestSequence=Math.max(state.latestSequence,Number(event.sequence ?? 0));
  state.updatedAt=event.timestamp ?? event.at ?? new Date().toISOString();
  state.events.push(stored);
  if (state.events.length>EVENT_LIMIT) state.events.splice(0,state.events.length-EVENT_LIMIT);
  if (state.sessions.length>SESSION_LIMIT) state.sessions.splice(0,state.sessions.length-SESSION_LIMIT);
  saveResearchReplay(state);
  return Object.freeze(stored);
}

export function recordReplayCheckpoint({
  sequence,
  timestamp = new Date().toISOString(),
  changeIntelligence = null,
  graphState = null
} = {}) {
  const value=Number(sequence);
  if (!Number.isFinite(value) || value<0) return null;
  const state=loadResearchReplay();
  const checkpoint={
    sequence:Math.floor(value),
    timestamp,
    changeIntelligence:cloneJson(changeIntelligence),
    graphState:cloneJson(graphState),
    historicalEntityIds:cloneJson(graphState?.entityIds ?? [])
  };
  state.checkpoints=state.checkpoints.filter((x)=>Number(x.sequence)!==checkpoint.sequence);
  state.checkpoints.push(checkpoint);
  state.checkpoints.sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  if (state.checkpoints.length>CHECKPOINT_LIMIT) state.checkpoints.splice(0,state.checkpoints.length-CHECKPOINT_LIMIT);
  state.updatedAt=timestamp;
  saveResearchReplay(state);
  return Object.freeze(checkpoint);
}

function publicSession(session,events) {
  const sessionEvents=events.filter((e)=>e.sessionId===session.id);
  const milestones=sessionEvents.filter((e)=>MILESTONE_TYPES.has(e.type)).map((e)=>({
    sequence:e.sequence,timestamp:e.timestamp ?? e.at,type:e.type,topicId:e.topicId ?? null,summary:e.summary ?? null
  }));
  return Object.freeze({...cloneJson(session),milestones:Object.freeze(milestones)});
}

export function replayTimeline() {
  const state=loadResearchReplay(),events=state.events;
  return Object.freeze({
    schemaVersion:SCHEMA_VERSION,
    generatedAt:new Date().toISOString(),
    updatedAt:state.updatedAt,
    earliestSequence:events[0]?.sequence ?? state.latestSequence,
    latestSequence:state.latestSequence,
    eventCount:events.length,
    checkpointCount:state.checkpoints.length,
    sessions:Object.freeze(state.sessions.map((s)=>publicSession(s,events))),
    milestones:Object.freeze(events.filter((e)=>MILESTONE_TYPES.has(e.type)).map((e)=>({
      sequence:e.sequence,timestamp:e.timestamp ?? e.at,type:e.type,taskId:e.taskId ?? null,sessionId:e.sessionId ?? null,topicId:e.topicId ?? null,summary:e.summary ?? null
    })))
  });
}

export function replayVerificationStateAt(sequence) {
  const state=loadResearchReplay();
  const target=Number.isFinite(Number(sequence)) ? Math.max(0,Math.floor(Number(sequence))) : state.latestSequence;
  const latest=new Map();
  for (const event of state.events) {
    if (Number(event.sequence ?? 0)>target) break;
    const status=VERIFICATION_STATUS[event.type];
    const id=String(event.targetId ?? "").trim();
    if (!status || !id) continue;
    latest.set(id,{targetId:id,status,sequence:event.sequence,timestamp:event.timestamp ?? event.at,summary:event.summary ?? null});
  }
  return Object.freeze({updatedAt:[...latest.values()].at(-1)?.timestamp ?? null,entries:[...latest.values()]});
}

export function replayFrame(sequence) {
  const state=loadResearchReplay();
  const requested=Number(sequence);
  const target=Number.isFinite(requested) ? Math.max(0,Math.min(state.latestSequence,Math.floor(requested))) : state.latestSequence;
  const visible=state.events.filter((e)=>Number(e.sequence ?? 0)<=target);
  const activity=visible.at(-1) ?? null;
  const checkpoint=[...state.checkpoints].reverse().find((x)=>Number(x.sequence ?? 0)<=target) ?? null;
  const session=activity?.sessionId ? state.sessions.find((x)=>x.id===activity.sessionId) ?? null : null;
  return Object.freeze({
    schemaVersion:SCHEMA_VERSION,
    generatedAt:new Date().toISOString(),
    sequence:target,
    latestSequence:state.latestSequence,
    live:target>=state.latestSequence,
    activity:activity ? Object.freeze(cloneJson(activity)) : null,
    session:session ? publicSession(session,visible) : null,
    changeIntelligence:checkpoint?.changeIntelligence ? Object.freeze(cloneJson(checkpoint.changeIntelligence)) : null,
    graphState:checkpoint?.graphState ? Object.freeze(cloneJson(checkpoint.graphState)) : null,
    checkpoint:checkpoint ? Object.freeze(cloneJson(checkpoint)) : null,
    verification:replayVerificationStateAt(target)
  });
}
