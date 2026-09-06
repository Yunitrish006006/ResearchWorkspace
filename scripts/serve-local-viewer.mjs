#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { knowledgeSummary } from "../intelligence/research-knowledge.mjs";
import { buildGraphViewModel } from "../intelligence/graph-view-model.mjs";
import { buildOrchestrationPlan } from "../intelligence/orchestration-plan.mjs";
import { researchChangeIntelligence } from "../intelligence/change-intelligence.mjs";
import { loadVerificationState } from "../intelligence/verification-state.mjs";
import { replayFrame, replayTimeline } from "../intelligence/research-replay.mjs";
import { activityEvents, emitActivity } from "../intelligence/activity-stream.mjs";
import { agentAdapterStatus } from "../intelligence/agent-adapter.mjs";
import { buildSourceIndex } from "../intelligence/source-index.mjs";
import { renderGraphV2 } from "./render-graph-v2.mjs";
import { repositoryStatusSummary } from "../intelligence/repository-status.mjs";
import { buildClaimEvidenceMatrix } from "../intelligence/claim-evidence-matrix.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,".."),site=path.join(root,"site");
const host="127.0.0.1",port=Number(process.env.RESEARCH_VIEWER_PORT||18775);
const MAX_BODY=64*1024,MAX_PROMPT=8192;
const settingsPath=path.join(root,".research-index","viewer-settings.json");
function defaultSettings(){return{promptEnabled:false,agentActivityEnabled:true,replayEnabled:true,changeAnimationsEnabled:true}}
function loadSettings(){return fs.existsSync(settingsPath)?{...defaultSettings(),...JSON.parse(fs.readFileSync(settingsPath,"utf8"))}:defaultSettings()}
function saveSettings(value){fs.mkdirSync(path.dirname(settingsPath),{recursive:true});const next={...defaultSettings(),...value};fs.writeFileSync(settingsPath,JSON.stringify(next,null,2));return next}
function originAllowed(origin){if(!origin)return true;try{const u=new URL(origin);return["127.0.0.1","localhost","::1"].includes(u.hostname)}catch{return false}}
function cors(req,res){const origin=req.headers.origin;if(origin&&originAllowed(origin)){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin")}res.setHeader("Access-Control-Allow-Headers","Content-Type");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS")}
function json(req,res,status,value){cors(req,res);res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(value))}
function body(req){return new Promise((resolve,reject)=>{let total=0,chunks=[];req.on("data",(chunk)=>{total+=chunk.length;if(total>MAX_BODY){reject(new Error("request body too large"));req.destroy();return}chunks.push(chunk)});req.on("end",()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"))}catch(error){reject(error)}});req.on("error",reject)})}
function serveStatic(req,res){const raw=req.url.split("?")[0],rel=raw==="/"?"index.html":raw.replace(/^\//,""),full=path.resolve(site,rel);if(!full.startsWith(site)||!fs.existsSync(full)||fs.statSync(full).isDirectory()){res.statusCode=404;res.end("Not found");return}const ext=path.extname(full),type={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"}[ext]||"application/octet-stream";res.setHeader("Content-Type",type);res.end(fs.readFileSync(full))}
const server=http.createServer(async(req,res)=>{
  cors(req,res);if(req.method==="OPTIONS"){res.statusCode=204;res.end();return}
  try{
    const url=new URL(req.url,`http://${host}:${port}`);
    if(url.pathname==="/api/health"&&req.method==="GET")return json(req,res,200,{ok:true,service:"research-local-bridge",summary:knowledgeSummary()});
    if(url.pathname==="/api/agent-adapter"&&req.method==="GET")return json(req,res,200,agentAdapterStatus());
    if(url.pathname==="/api/graph-data"&&req.method==="GET")return json(req,res,200,buildGraphViewModel());
    if(url.pathname==="/api/repository-status"&&req.method==="GET")return json(req,res,200,repositoryStatusSummary());
    if(url.pathname==="/api/claim-evidence-matrix"&&req.method==="GET")return json(req,res,200,buildClaimEvidenceMatrix());
    if(url.pathname==="/api/viewer-settings"&&req.method==="GET")return json(req,res,200,loadSettings());
    if(url.pathname==="/api/viewer-settings"&&req.method==="POST")return json(req,res,200,saveSettings(await body(req)));
    if(url.pathname==="/api/activity"&&req.method==="GET")return json(req,res,200,{events:activityEvents({after:Number(url.searchParams.get("after")||0),limit:Number(url.searchParams.get("limit")||200)})});
    if(url.pathname==="/api/activity"&&req.method==="POST")return json(req,res,200,emitActivity(await body(req)));
    if(url.pathname==="/api/orchestration-plan"&&req.method==="POST"){const data=await body(req);const plan=buildOrchestrationPlan({query:String(data.query||""),topicId:data.topicId??null,claimId:data.claimId??null,changedTopics:data.changedTopics??[],changedFiles:data.changedFiles??[]});emitActivity({type:"orchestration_planned",summary:`${plan.mode} score ${plan.score}`,plan});return json(req,res,200,plan)}
    if(url.pathname==="/api/change-intelligence"&&req.method==="GET")return json(req,res,200,researchChangeIntelligence());
    if(url.pathname==="/api/verification-state"&&req.method==="GET")return json(req,res,200,loadVerificationState());
    if(url.pathname==="/api/replay"&&req.method==="GET")return json(req,res,200,replayTimeline());
    if(url.pathname==="/api/replay/frame"&&req.method==="GET")return json(req,res,200,replayFrame(Number(url.searchParams.get("sequence")||0)));
    if(url.pathname==="/api/prompt"&&req.method==="POST"){
      const settings=loadSettings();if(!settings.promptEnabled)return json(req,res,403,{error:"prompt-disabled"});
      const data=await body(req),prompt=String(data.prompt||"").trim();
      if(!prompt||prompt.length>MAX_PROMPT)return json(req,res,400,{error:"invalid-prompt"});
      const event=emitActivity({type:"prompt_submitted",summary:prompt.slice(0,160)}),plan=buildOrchestrationPlan({query:prompt}),adapter=agentAdapterStatus();
      return json(req,res,200,{event,orchestration:plan,adapter,execution:adapter.enabled?"agent-adapter-ready":"agent-adapter-unavailable"});
    }
    if(url.pathname==="/api/refresh"&&req.method==="POST"){
      const index=buildSourceIndex(),graph=renderGraphV2(),change=researchChangeIntelligence();
      emitActivity({type:"research_change",summary:"workspace refreshed",change});
      return json(req,res,200,{index:{files:index.files,chunks:index.chunks.length,rootPresent:index.rootPresent},graph,change});
    }
    serveStatic(req,res);
  }catch(error){json(req,res,500,{error:error instanceof Error?error.message:String(error)})}
});
server.listen(port,host,()=>console.log(`ResearchWorkspace Local Bridge http://${host}:${port}`));
