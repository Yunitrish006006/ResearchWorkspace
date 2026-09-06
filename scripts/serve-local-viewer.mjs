#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadKnowledge, knowledgeSummary } from "../intelligence/research-knowledge.mjs";
import { buildGraphViewModel } from "../intelligence/graph-view-model.mjs";
import { buildOrchestrationPlan } from "../intelligence/orchestration-plan.mjs";
import { researchChangeIntelligence } from "../intelligence/change-intelligence.mjs";
import { loadVerificationState } from "../intelligence/verification-state.mjs";
import { replayFrame, replayTimeline, recordReplayCheckpoint } from "../intelligence/research-replay.mjs";
import { activityEvents, emitActivity } from "../intelligence/activity-stream.mjs";
import { createAgentAdapter } from "../intelligence/agent-adapter.mjs";
import { createConversationSync } from "../intelligence/conversation-sync.mjs";
import { buildSourceIndex, thesisRoot } from "../intelligence/source-index.mjs";
import { renderGraphV2 } from "./render-graph-v2.mjs";
import { repositoryStatusSummary } from "../intelligence/repository-status.mjs";
import { buildClaimEvidenceMatrix } from "../intelligence/claim-evidence-matrix.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,".."),site=path.join(root,"site");
const host="127.0.0.1";
const argvPort=process.argv.indexOf("--port")>=0?Number(process.argv[process.argv.indexOf("--port")+1]):null;
const port=argvPort||Number(process.env.RESEARCH_VIEWER_PORT||18775);
const MAX_BODY=64*1024,MAX_PROMPT=8192;
const settingsPath=path.join(root,".research-index","viewer-settings.json");
const conversationToken=String(process.env.RESEARCH_CONVERSATION_SYNC_TOKEN||"").trim();
const knowledge=loadKnowledge();
const conversation=createConversationSync();

function defaultSettings(){return{promptEnabled:false,agentActivityEnabled:true,replayEnabled:true,changeAnimationsEnabled:true}}
function loadSettings(){return fs.existsSync(settingsPath)?{...defaultSettings(),...JSON.parse(fs.readFileSync(settingsPath,"utf8"))}:defaultSettings()}
function saveSettings(value){fs.mkdirSync(path.dirname(settingsPath),{recursive:true});const next={...defaultSettings(),...value};fs.writeFileSync(settingsPath,JSON.stringify(next,null,2));return next}
function isLoopbackOrigin(origin){if(!origin)return true;try{const u=new URL(origin);return["127.0.0.1","localhost","::1"].includes(u.hostname)}catch{return false}}
function originAllowed(origin){if(!origin)return true;try{const u=new URL(origin);return isLoopbackOrigin(origin)||(u.protocol==="https:"&&u.hostname==="yunitrish006006.github.io")}catch{return false}}
function cors(req,res){const origin=req.headers.origin;if(origin&&originAllowed(origin)){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin")}res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS")}
function json(req,res,status,value){cors(req,res);res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(value))}
function body(req){return new Promise((resolve,reject)=>{let total=0,chunks=[];req.on("data",(chunk)=>{total+=chunk.length;if(total>MAX_BODY){reject(new Error("request body too large"));req.destroy();return}chunks.push(chunk)});req.on("end",()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"))}catch(error){reject(error)}});req.on("error",reject)})}
function bearerToken(req){const raw=String(req.headers.authorization||"");return raw.startsWith("Bearer ")?raw.slice(7).trim():""}
function sameSecret(expected,received){if(!expected||!received)return false;const a=Buffer.from(expected),b=Buffer.from(received);return a.length===b.length&&timingSafeEqual(a,b)}
function graphState(){
  const model=buildGraphViewModel(knowledge);
  return {
    generatedAt:new Date().toISOString(),
    entityIds:[model.root.id,...model.topics.map(x=>x.id),...model.claims.map(x=>x.id),...model.studies.map(x=>x.id),...model.evidence.map(x=>x.id),...model.reviews.map(x=>x.id)].sort(),
    relationIds:model.relations.map(x=>x.id).sort()
  };
}
function safeConversationProgress(event){
  if(!event?.taskId)return null;
  const map={
    task_started:"Codex task started",thread_started:"Codex session started",turn_started:"Codex is processing the request",
    command_started:"Codex is running a local command",command_completed:event.status==="failed"?"A local command failed":"A local command completed",
    tool_started:"Codex is using an integration tool",tool_completed:event.status==="failed"?"An integration tool failed":"An integration tool completed",
    file_edit:"Codex changed a workspace file",todo_updated:"Codex updated its plan",web_search_started:"Codex started a web search",
    web_search_completed:"Codex completed a web search",task_completed:"Codex task completed",task_failed:"Codex task failed"
  };
  return map[event.type]??null;
}
function emit(event){
  const stored=emitActivity(event);
  const progress=safeConversationProgress(stored);
  if(progress){
    conversation.append({source:"workspace",kind:["task_completed","task_failed"].includes(stored.type)?"status":"progress",text:progress,taskId:stored.taskId,status:stored.type==="task_failed"?"failed":stored.type==="task_completed"?"completed":null});
  }
  return stored;
}
async function settleRefresh(task){
  let index=null,graph=null,change=null;
  try{index=buildSourceIndex()}catch{}
  try{graph=renderGraphV2()}catch{}
  try{change=researchChangeIntelligence({persist:true})}catch{}
  const cp=emit({type:"checkpoint",source:"bridge",taskId:task?.id??null,topicId:task?.topicId??null,claimId:task?.claimId??null,summary:"Post-task research checkpoint"});
  recordReplayCheckpoint({sequence:cp.sequence,changeIntelligence:change,graphState:graphState()});
  return {index,graph,change};
}
const agentAdapter=createAgentAdapter({workspaceRoot:root,thesisRoot:thesisRoot(),knowledge,onActivity:emit,onTaskSettled:settleRefresh});

function serveStatic(req,res){
  const raw=req.url.split("?")[0],rel=raw==="/"?"index.html":raw.replace(/^\//,""),full=path.resolve(site,rel);
  if(!full.startsWith(site)||!fs.existsSync(full)||fs.statSync(full).isDirectory()){res.statusCode=404;res.end("Not found");return}
  const ext=path.extname(full),type={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"}[ext]||"application/octet-stream";
  res.setHeader("Content-Type",type);res.end(fs.readFileSync(full));
}
async function submitPrompt(data,{source="viewer",clientMessageId=null}={}){
  const settings=loadSettings();
  if(!settings.promptEnabled)return{status:403,payload:{error:"prompt-disabled"}};
  const prompt=String(data.prompt||"").trim();
  if(!prompt||prompt.length>MAX_PROMPT)return{status:400,payload:{error:"invalid-prompt"}};
  const duplicate=clientMessageId?conversation.submission(clientMessageId):null;
  if(duplicate)return{status:202,payload:{status:"accepted",execution:"duplicate",event:null,task:null,conversation:duplicate}};
  const conversationId=clientMessageId||source+":prompt:"+Date.now();
  const conversationEntry=conversation.append({source,kind:"prompt",text:prompt,clientMessageId,conversationId}).entry;
  if(source==="viewer")conversation.clearDraft(data.clientId);
  const event=emit({type:"prompt_submitted",source,topicId:data.topicId??null,claimId:data.claimId??null,summary:"Prompt submitted from "+source});
  const plan=buildOrchestrationPlan({query:prompt,topicId:data.topicId??null,claimId:data.claimId??null,changedTopics:data.changedTopics??[],changedFiles:data.changedFiles??[],knowledge});
  emit({type:"orchestration_planned",source:"bridge",topicId:data.topicId??null,claimId:data.claimId??null,summary:plan.mode+" · score "+plan.score,plan});
  const adapter=agentAdapter.status();
  if(!adapter.available){
    conversation.append({source:"workspace",kind:"status",text:"Prompt recorded, but the local Codex adapter is unavailable",conversationId});
    return{status:202,payload:{status:"accepted",execution:"agent-adapter-unavailable",event,task:null,adapter,orchestration:plan,conversation:conversationEntry}};
  }
  try{
    const task=agentAdapter.dispatch({prompt,topicId:data.topicId??null,claimId:data.claimId??null,summary:event.summary,orchestrationPlan:plan});
    conversation.linkTask(task.id,conversationId);
    return{status:202,payload:{status:"accepted",execution:"codex",event,task,adapter:agentAdapter.status(),orchestration:plan,conversation:conversationEntry}};
  }catch(error){
    const code=error?.code,status=code==="AGENT_BUSY"?409:code==="INVALID_PROMPT"?400:503;
    conversation.append({source:"workspace",kind:"status",text:code==="AGENT_BUSY"?"Codex is already working on another prompt":"Codex could not start this prompt",status:code==="AGENT_BUSY"?"busy":"failed",conversationId});
    return{status,payload:{error:error instanceof Error?error.message:String(error),execution:"not-started",event,adapter:agentAdapter.status(),orchestration:plan,conversation:conversationEntry}};
  }
}

const server=http.createServer(async(req,res)=>{
  cors(req,res);if(req.method==="OPTIONS"){res.statusCode=204;res.end();return}
  try{
    const url=new URL(req.url,"http://"+host+":"+port);
    if(url.pathname==="/api/health"&&req.method==="GET")return json(req,res,200,{status:"ok",mode:"local",ok:true,service:"research-local-bridge",port,summary:knowledgeSummary(),adapter:agentAdapter.status()});
    if(url.pathname==="/api/agent-adapter"&&req.method==="GET")return json(req,res,200,agentAdapter.status());
    if(url.pathname==="/api/graph-data"&&req.method==="GET")return json(req,res,200,buildGraphViewModel());
    if(url.pathname==="/api/repository-status"&&req.method==="GET")return json(req,res,200,repositoryStatusSummary());
    if(url.pathname==="/api/claim-evidence-matrix"&&req.method==="GET")return json(req,res,200,buildClaimEvidenceMatrix());
    if(url.pathname==="/api/viewer-settings"&&req.method==="GET")return json(req,res,200,loadSettings());
    if(url.pathname==="/api/viewer-settings"&&req.method==="POST")return json(req,res,200,saveSettings(await body(req)));
    if(url.pathname==="/api/activity"&&req.method==="GET")return json(req,res,200,{events:activityEvents({after:Number(url.searchParams.get("after")||0),limit:Number(url.searchParams.get("limit")||200)})});
    if(url.pathname==="/api/activity"&&req.method==="POST")return json(req,res,200,emit(await body(req)));
    if(url.pathname==="/api/orchestration-plan"&&req.method==="POST"){const data=await body(req);return json(req,res,200,buildOrchestrationPlan({query:String(data.query||""),topicId:data.topicId??null,claimId:data.claimId??null,changedTopics:data.changedTopics??[],changedFiles:data.changedFiles??[],knowledge}))}
    if(url.pathname==="/api/change-intelligence"&&req.method==="GET")return json(req,res,200,researchChangeIntelligence({persist:true}));
    if(url.pathname==="/api/verification-state"&&req.method==="GET")return json(req,res,200,loadVerificationState());
    if(url.pathname==="/api/replay"&&req.method==="GET")return json(req,res,200,replayTimeline());
    if(url.pathname==="/api/replay/frame"&&req.method==="GET")return json(req,res,200,replayFrame(Number(url.searchParams.get("sequence")||0)));
    if(url.pathname==="/api/prompt"&&req.method==="POST"){const result=await submitPrompt(await body(req),{source:"viewer"});return json(req,res,result.status,result.payload)}
    if(url.pathname==="/api/refresh"&&req.method==="POST"){
      const index=buildSourceIndex(),graph=renderGraphV2(),change=researchChangeIntelligence({persist:true});
      const event=emit({type:"research_change",source:"bridge",summary:"workspace refreshed",change});
      recordReplayCheckpoint({sequence:event.sequence,changeIntelligence:change,graphState:graphState()});
      return json(req,res,200,{index:{files:index.files,chunks:index.chunks.length,rootPresent:index.rootPresent},graph,change});
    }
    if(url.pathname==="/api/conversation"&&req.method==="GET"){
      const allowed=!req.headers.origin||isLoopbackOrigin(req.headers.origin)||sameSecret(conversationToken,bearerToken(req));
      if(!allowed)return json(req,res,403,{error:"conversation is available only to the loopback viewer or authenticated transport"});
      return json(req,res,200,conversation.snapshot({after:url.searchParams.get("after")??0}));
    }
    if(url.pathname==="/api/conversation/draft"&&req.method==="POST"){
      if(req.headers.origin&&!isLoopbackOrigin(req.headers.origin))return json(req,res,403,{error:"draft updates require the loopback viewer"});
      if(!loadSettings().promptEnabled)return json(req,res,403,{error:"prompt-disabled"});
      const data=await body(req);const draft=conversation.setDraft({clientId:data.clientId,text:data.text});
      return json(req,res,202,{status:"accepted",draft,latestRevision:conversation.snapshot().latestRevision});
    }
    if(url.pathname==="/api/conversation/prompt"&&req.method==="POST"){
      if(!conversationToken)return json(req,res,503,{error:"conversation transport is not configured"});
      if(!sameSecret(conversationToken,bearerToken(req)))return json(req,res,401,{error:"conversation transport is unauthorized"});
      const data=await body(req),result=await submitPrompt(data,{source:"discord",clientMessageId:String(data.clientMessageId||"").trim()||null});
      return json(req,res,result.status,result.payload);
    }
    if(url.pathname==="/api/conversation/cancel"&&req.method==="POST"){
      if(!conversationToken)return json(req,res,503,{error:"conversation transport is not configured"});
      if(!sameSecret(conversationToken,bearerToken(req)))return json(req,res,401,{error:"conversation transport is unauthorized"});
      const active=agentAdapter.status().currentTask;if(!active)return json(req,res,200,{status:"idle",task:null});
      agentAdapter.close("Cancelled from authenticated conversation transport");
      conversation.append({source:"workspace",kind:"status",text:"Codex task cancellation requested",taskId:active.id,status:"cancelled"});
      return json(req,res,202,{status:"cancelling",task:active});
    }
    serveStatic(req,res);
  }catch(error){json(req,res,500,{error:error instanceof Error?error.message:String(error)})}
});
server.listen(port,host,()=>console.log("ResearchWorkspace Local Bridge http://"+host+":"+port));
function shutdown(signal){agentAdapter.close("Bridge stopped by "+signal);server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref()}
process.on("SIGINT",()=>shutdown("SIGINT"));
process.on("SIGTERM",()=>shutdown("SIGTERM"));
