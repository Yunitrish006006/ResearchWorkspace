#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createAgentAdapter } from "../intelligence/agent-adapter.mjs";

function fakeChild(){
  const child=new EventEmitter();
  child.stdin=new PassThrough();
  child.stdout=new PassThrough();
  child.stderr=new PassThrough();
  child.killed=false;
  child.kill=()=>{child.killed=true;return true};
  return child;
}
const tick=()=>new Promise((resolve)=>setImmediate(resolve));

const temp=fs.mkdtempSync(path.join(os.tmpdir(),"research-agent-adapter-"));
const workspaceRoot=path.join(temp,"ResearchWorkspace");
const thesisRoot=path.join(temp,"Three-Factor-Digital-Twin");
const thesisFile=path.join(thesisRoot,"docs","thesis","thesis_sync_status_zh.md");
fs.mkdirSync(workspaceRoot,{recursive:true});
fs.mkdirSync(path.dirname(thesisFile),{recursive:true});
fs.writeFileSync(thesisFile,"sync\n");

const claim={id:"claim-sync",ownerId:"governance",title:"Artifact synchronization",summary:"sync",sources:["docs/thesis/thesis_sync_status_zh.md"]};
const knowledge={claims:[claim],evidence:[],claimById:new Map([[claim.id,claim]])};

try{
  const off=createAgentAdapter({
    workspaceRoot,thesisRoot,knowledge,
    env:{RESEARCH_AGENT_ADAPTER:"off"},
    spawnSyncImpl(){throw new Error("disabled adapter must not probe Codex")}
  });
  assert.equal(off.status().configured,false);
  assert.equal(off.status().available,false);
  assert.throws(()=>off.dispatch({prompt:"x"}),(error)=>error.code==="ADAPTER_UNAVAILABLE");

  const activity=[],settled=[],spawned=[];
  let child=fakeChild(),stdin="";
  child.stdin.setEncoding("utf8");
  child.stdin.on("data",(chunk)=>{stdin+=chunk});
  const adapter=createAgentAdapter({
    workspaceRoot,thesisRoot,knowledge,
    env:{
      RESEARCH_AGENT_ADAPTER:"codex",
      RESEARCH_CODEX_BIN:"codex-fixture",
      RESEARCH_CODEX_CWD:thesisRoot,
      RESEARCH_CODEX_SANDBOX:"workspace-write",
      RESEARCH_CODEX_MODEL:"fixture-model"
    },
    spawnSyncImpl(command,args,options){
      assert.equal(command,"codex-fixture");
      assert.deepEqual(args,["--version"]);
      assert.equal(options.cwd,thesisRoot);
      return {status:0,stdout:"codex-cli fixture\n",stderr:""};
    },
    spawnImpl(command,args,options){spawned.push({command,args,options});return child},
    onActivity(event){activity.push(event);return event},
    async onTaskSettled(task){settled.push(task)}
  });
  assert.equal(adapter.status().configured,true);
  assert.equal(adapter.status().available,true);
  assert.equal(adapter.status().busy,false);

  const plan={
    mode:"bounded-parallel",score:7,
    assignments:[
      {role:"literature-scout",scope:["governance"],access:"read-only",wave:"discovery"},
      {role:"evidence-extractor",scope:["governance"],access:"write",wave:"extraction"}
    ],
    constraints:{maxSubagents:4,maxParallelEvidenceExtractors:2}
  };
  const task=adapter.dispatch({
    prompt:"Update the thesis synchronization evidence and validate it.",
    topicId:"governance",claimId:"claim-sync",orchestrationPlan:plan
  });
  assert.equal(task.state,"running");
  assert.equal(adapter.status().busy,true);
  assert.equal(spawned.length,1);
  assert.deepEqual(spawned[0].args,[
    "exec","--json","--skip-git-repo-check","--sandbox","workspace-write","--cd",thesisRoot,"--model","fixture-model","-"
  ]);
  assert.ok(!spawned[0].args.includes("--full-auto"));
  assert.ok(!spawned[0].args.some((x)=>/dangerously|bypass/i.test(x)));
  assert.throws(()=>adapter.dispatch({prompt:"second"}),(error)=>error.code==="AGENT_BUSY");
  await tick();
  assert.match(stdin,/ResearchWorkspace local Codex agent adapter/);
  assert.match(stdin,/Mode: bounded-parallel; score: 7/);
  assert.match(stdin,/No subagent may spawn further subagents/);
  assert.match(stdin,/Evidence Extractor writes only within its one assigned Topic scope/);

  child.stdout.write('{"type":"thread.started","thread_id":"thread-fixture"}\n');
  child.stdout.write('{"type":"turn.started"}\n');
  child.stdout.write(JSON.stringify({type:"item.started",item:{id:"mcp-1",type:"mcp_tool_call",server:"researchWorkspace",tool:"context_pack",status:"in_progress"}})+"\n");
  child.stdout.write(JSON.stringify({type:"item.completed",item:{id:"mcp-1",type:"mcp_tool_call",server:"researchWorkspace",tool:"context_pack",status:"completed",result:{ok:true,nodes:3}}})+"\n");
  child.stdout.write(JSON.stringify({type:"item.completed",item:{id:"file-1",type:"file_change",changes:[{path:thesisFile,kind:"update"}],status:"completed"}})+"\n");
  child.stdout.write(JSON.stringify({type:"item.started",item:{id:"command-1",type:"command_execution",command:'git commit -m "fixture"',status:"in_progress"}})+"\n");
  child.stdout.write(JSON.stringify({type:"item.completed",item:{id:"command-1",type:"command_execution",command:'git commit -m "fixture"',aggregated_output:"[main abc123] fixture",exit_code:0,status:"completed"}})+"\n");
  child.stdout.write(JSON.stringify({type:"item.completed",item:{id:"command-2",type:"command_execution",command:'gh pr create --title "fixture"',aggregated_output:"https://github.com/example/repo/pull/1",exit_code:0,status:"completed"}})+"\n");
  child.stdout.write(JSON.stringify({type:"item.completed",item:{id:"message-1",type:"agent_message",text:"Updated synchronization evidence and validated the changed surface."}})+"\n");
  child.stdout.write('{"type":"turn.completed","usage":{"input_tokens":10,"cached_input_tokens":2,"output_tokens":3,"reasoning_output_tokens":1}}\n');
  await tick();await tick();

  const done=adapter.status();
  assert.equal(done.busy,false);
  assert.equal(done.lastTask?.state,"completed");
  assert.equal(done.lastTask?.threadId,"thread-fixture");
  assert.equal(done.lastTask?.usage?.inputTokens,10);
  assert.equal(done.lastTask?.usage?.outputTokens,3);
  assert.equal(settled.length,1);
  for(const type of ["task_started","thread_started","turn_started","tool_started","tool_completed","dependency_followed","file_edit","command_started","command_completed","commit_created","pr_created","agent_message","usage_updated","task_completed"]){
    assert.ok(activity.some((event)=>event.type===type),"missing activity event "+type);
  }
  const fileEdit=activity.find((event)=>event.type==="file_edit");
  assert.equal(fileEdit.repository,"Three-Factor-Digital-Twin");
  assert.equal(fileEdit.file,"docs/thesis/thesis_sync_status_zh.md");
  assert.equal(fileEdit.claimId,"claim-sync");
  assert.equal(fileEdit.topicId,"governance");
  assert.ok(!fileEdit.file.includes(temp),"activity must not expose absolute workspace paths");

  child.emit("close",0,null);await tick();
  assert.equal(settled.length,1,"process close after turn.completed must not settle twice");

  child=fakeChild();
  const failing=createAgentAdapter({
    workspaceRoot,thesisRoot,knowledge,
    env:{RESEARCH_AGENT_ADAPTER:"codex",RESEARCH_CODEX_CWD:workspaceRoot},
    spawnSyncImpl(){return{status:0,stdout:"codex fixture\n",stderr:""}},
    spawnImpl(){return child},
    onActivity(event){activity.push(event)},
    async onTaskSettled(taskValue){settled.push(taskValue)}
  });
  const failed=failing.dispatch({prompt:"Fail fixture"});
  child.stdout.write('{"type":"turn.failed","error":{"message":"fixture failure"}}\n');
  await tick();await tick();
  assert.equal(failing.status().lastTask?.state,"failed");
  assert.ok(activity.some((event)=>event.type==="task_failed"&&event.taskId===failed.id));

  child=fakeChild();
  const interrupted=createAgentAdapter({
    workspaceRoot,thesisRoot,knowledge,
    env:{RESEARCH_AGENT_ADAPTER:"codex",RESEARCH_CODEX_CWD:workspaceRoot},
    spawnSyncImpl(){return{status:0,stdout:"codex fixture\n",stderr:""}},
    spawnImpl(){return child},
    onActivity(event){activity.push(event)}
  });
  const interruptedTask=interrupted.dispatch({prompt:"Long fixture"});
  interrupted.close("Bridge restart interrupted active task");
  await tick();
  assert.equal(child.killed,true);
  assert.equal(interrupted.status().lastTask?.state,"failed");
  assert.ok(activity.some((event)=>event.type==="task_failed"&&event.taskId===interruptedTask.id));

  const unsafe=createAgentAdapter({
    workspaceRoot,thesisRoot,knowledge,
    env:{RESEARCH_AGENT_ADAPTER:"codex",RESEARCH_CODEX_CWD:path.dirname(temp)},
    spawnSyncImpl(){throw new Error("unsafe cwd must fail before probe")}
  });
  assert.equal(unsafe.status().available,false);
  assert.match(unsafe.status().reason??"",/cwd must stay inside/);
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
console.log("Codex Research Agent Adapter runtime contract OK");
