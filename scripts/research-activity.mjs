#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { activityStatus, emitActivity } from "../intelligence/activity-stream.mjs";
import { loadKnowledge, workspaceRoot } from "../intelligence/research-knowledge.mjs";
import { loadVerificationState } from "../intelligence/verification-state.mjs";
import { replayFrame, replayTimeline } from "../intelligence/research-replay.mjs";

const [command,...args]=process.argv.slice(2),print=(x)=>console.log(JSON.stringify(x,null,2));
const settingsPath=path.join(workspaceRoot,".research-index","viewer-settings.json");
function settings(){
  if(!fs.existsSync(settingsPath))return{promptEnabled:false,agentActivityEnabled:true,replayEnabled:true,changeAnimationsEnabled:true};
  return JSON.parse(fs.readFileSync(settingsPath,"utf8"));
}
function setPrompt(value){
  const next={...settings(),promptEnabled:value};fs.mkdirSync(path.dirname(settingsPath),{recursive:true});fs.writeFileSync(settingsPath,JSON.stringify(next,null,2)+"\n");return next;
}
function verify(type,targetId,summary){
  const k=loadKnowledge(),known=new Set([...k.reviews.map(x=>x.id),...k.claims.map(x=>x.id),...k.verificationChecks.map(x=>x.id)]);
  if(!known.has(targetId))throw new Error("Unknown verification target: "+targetId);
  return emitActivity({type,targetId,source:"cli",summary:summary||type+" "+targetId});
}
switch(command){
  case"status":print({activity:activityStatus(),verification:loadVerificationState(),settings:settings(),replay:replayTimeline()});break;
  case"emit":print(emitActivity(JSON.parse(args.join(" "))));break;
  case"verify":{
    const state=args[0],target=args[1],summary=args.slice(2).join(" ");
    const type=state==="start"?"verification_started":state==="pass"?"verification_passed":state==="fail"?"verification_failed":null;
    if(!type)throw new Error("verify state must be start|pass|fail");
    print({event:verify(type,target,summary),state:loadVerificationState()});break;
  }
  case"replay":print(args[0]==null?replayTimeline():replayFrame(Number(args[0])));break;
  case"prompt":if(args[0]==="on")print(setPrompt(true));else if(args[0]==="off")print(setPrompt(false));else throw new Error("prompt must be on|off");break;
  default:console.error("Usage: research-activity.mjs status | emit <json> | verify <start|pass|fail> <target> [summary] | replay [sequence] | prompt <on|off>");process.exitCode=2;
}
