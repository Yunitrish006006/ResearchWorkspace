import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { workspaceRoot as defaultWorkspaceRoot, loadKnowledge } from "./research-knowledge.mjs";
import { thesisRoot as defaultThesisRoot } from "./source-index.mjs";

const ADAPTER_SCHEMA_VERSION=2;
const ALLOWED_SANDBOXES=new Set(["read-only","workspace-write"]);

function boundedText(value,limit=500){
  if(value==null)return null;
  const text=String(value).trim();
  if(!text)return null;
  return text.length<=limit?text:text.slice(0,limit);
}
function isInside(base,target){
  const relative=path.relative(base,target);
  return relative===""||(!relative.startsWith("..")&&!path.isAbsolute(relative));
}
function sanitizeMessage(value,roots){
  let text=boundedText(value,1000)??"";
  for(const root of roots.filter(Boolean))text=text.split(root).join("<workspace>");
  return text;
}
function safeCwd(value,{workspaceRoot,thesisRoot}){
  const resolved=path.resolve(value||workspaceRoot);
  if(!isInside(workspaceRoot,resolved)&&!isInside(thesisRoot,resolved))throw new Error("Codex adapter cwd must stay inside ResearchWorkspace or the canonical thesis repository");
  return resolved;
}
function nowIso(){return new Date().toISOString()}
function publicTask(task){
  if(!task)return null;
  return Object.freeze({
    schemaVersion:1,id:task.id,adapter:task.adapter,state:task.state,
    topicId:task.topicId??null,claimId:task.claimId??null,threadId:task.threadId??null,
    startedAt:task.startedAt,completedAt:task.completedAt??null,summary:task.summary??null,
    error:task.error??null,finalMessage:task.finalMessage??null,usage:task.usage??null,
    orchestration:task.orchestration??null
  });
}
function normalizedUsage(raw={}){
  const n=(v)=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
  const usage={
    inputTokens:n(raw.input_tokens??raw.inputTokens),
    cachedInputTokens:n(raw.cached_input_tokens??raw.cachedInputTokens),
    outputTokens:n(raw.output_tokens??raw.outputTokens),
    reasoningOutputTokens:n(raw.reasoning_output_tokens??raw.reasoningOutputTokens)
  };
  usage.totalTokens=usage.inputTokens+usage.outputTokens;
  return Object.freeze(usage);
}
function orchestrationEnvelope(plan){
  if(!plan)return[];
  const lines=[
    "",
    "ResearchWorkspace adaptive orchestration plan:",
    "Mode: "+plan.mode+"; score: "+plan.score+".",
    "Subagent budget: "+(plan.assignments?.length??0)+"/"+(plan.constraints?.maxSubagents??4)+"; max parallel evidence extractors: "+(plan.constraints?.maxParallelEvidenceExtractors??2)+".",
    "The Research Synthesizer owns integration and the final answer."
  ];
  for(const item of plan.assignments??[]){
    lines.push("Assignment: role="+item.role+"; scope="+((item.scope??[]).join(",")||"none")+"; access="+item.access+"; wave="+item.wave+".");
  }
  lines.push(
    "If this Codex runtime exposes multi-agent tools, follow the plan without exceeding the budget.",
    "No subagent may spawn further subagents.",
    "Literature Scout, Methodology Analyst, and Independent Reviewer are read-only.",
    "Evidence Extractor writes only within its one assigned Topic scope.",
    "Do not spawn subagents for primary-only.",
    "If multi-agent execution is unavailable, execute the same waves sequentially in Primary.",
    "Do not invent delegation telemetry."
  );
  return lines;
}
export function promptEnvelope(request){
  const lines=[
    "You are running through the ResearchWorkspace local Codex agent adapter.",
    "ResearchWorkspace is the research-intelligence coordination repository; the thesis repository is the canonical thesis source.",
    "Use the ResearchWorkspace graph, source index, MCP, Claim-to-Evidence Matrix, and repository instructions before broad search.",
    "Keep synthetic full-field, real target-point, public benchmark, and intervention evidence classes separate.",
    "Do not strengthen claims beyond their current evidence status.",
    "Do not expose secrets or absolute local filesystem paths in user-facing summaries."
  ];
  if(request.topicId)lines.push("Semantic Topic focus: "+request.topicId);
  if(request.claimId)lines.push("Semantic Claim focus: "+request.claimId);
  lines.push(...orchestrationEnvelope(request.orchestrationPlan));
  lines.push("","User request:",request.prompt);
  return lines.join("\n");
}
export function adapterConfiguration(env=process.env,{workspaceRoot=defaultWorkspaceRoot,thesisRoot=defaultThesisRoot()}={}){
  const configuredKind=(boundedText(env.RESEARCH_AGENT_ADAPTER,32)??"off").toLowerCase();
  const sandbox=boundedText(env.RESEARCH_CODEX_SANDBOX,64)??"workspace-write";
  if(!ALLOWED_SANDBOXES.has(sandbox))throw new Error("unsupported RESEARCH_CODEX_SANDBOX: "+sandbox);
  const cwd=safeCwd(env.RESEARCH_CODEX_CWD,{workspaceRoot,thesisRoot});
  return Object.freeze({
    configuredKind,codexBin:boundedText(env.RESEARCH_CODEX_BIN,512)??"codex",
    cwd,sandbox,model:boundedText(env.RESEARCH_CODEX_MODEL,128),
    workspaceRoot:path.resolve(workspaceRoot),thesisRoot:path.resolve(thesisRoot)
  });
}
export function buildCodexArgs({prompt,config}){
  if(!config||config.configuredKind!=="codex")throw new Error("Codex adapter is not enabled");
  const args=["exec","--json","--skip-git-repo-check","--sandbox",config.sandbox,"--cd",config.cwd];
  if(config.model)args.push("--model",config.model);
  args.push("-");
  if(args.includes("--full-auto")||args.some((x)=>/dangerously|bypass/i.test(x)))throw new Error("Unsafe Codex flag rejected");
  return Object.freeze({executable:config.codexBin,args,stdin:promptEnvelope({prompt})});
}
function itemOf(event){
  if(!event||typeof event!=="object")return null;
  if(!["item.started","item.updated","item.completed"].includes(event.type))return null;
  return event.item&&typeof event.item==="object"?event.item:null;
}
function jsonDetail(value,limit=6000){
  if(value==null)return null;
  try{return boundedText(typeof value==="string"?value:JSON.stringify(value,null,2),limit)}
  catch{return boundedText(String(value),limit)}
}
function semanticForFile(rawPath,{cwd,workspaceRoot,thesisRoot,knowledge}){
  if(!rawPath)return null;
  const normalized=String(rawPath).replaceAll("\\","/");
  const absolute=path.isAbsolute(normalized)?path.resolve(normalized):path.resolve(cwd,normalized);
  let repository=null,relative=null;
  if(isInside(thesisRoot,absolute)){
    repository="Three-Factor-Digital-Twin";
    relative=path.relative(thesisRoot,absolute).replaceAll("\\","/");
  }else if(isInside(workspaceRoot,absolute)){
    repository="ResearchWorkspace";
    relative=path.relative(workspaceRoot,absolute).replaceAll("\\","/");
  }else return null;
  if(!relative||relative.startsWith("../"))return null;
  let claimId=null,topicId=null;
  if(repository==="Three-Factor-Digital-Twin"){
    const claim=(knowledge.claims??[]).find((c)=>(c.sources??[]).some((s)=>relative===s||relative.endsWith(s)||s.endsWith(relative))) ??
      (knowledge.evidence??[]).map((e)=>({e,claim:knowledge.claimById?.get(e.claimId)})).find(({e})=>relative===e.path||relative.startsWith(e.path)||e.path.startsWith(relative))?.claim;
    if(claim){claimId=claim.id;topicId=claim.ownerId}
  }
  return Object.freeze({repository,file:relative,claimId,topicId});
}
export function createAgentAdapter({
  workspaceRoot=defaultWorkspaceRoot,
  thesisRoot=defaultThesisRoot(),
  knowledge=loadKnowledge(),
  env=process.env,
  spawnImpl=spawn,
  spawnSyncImpl=spawnSync,
  onActivity=()=>{},
  onTaskSettled=async()=>{}
}={}){
  let config;
  const state={configuredKind:"off",available:false,reason:null,version:null,activeTask:null,lastTask:null,child:null,counter:0};
  try{
    config=adapterConfiguration(env,{workspaceRoot,thesisRoot});
    state.configuredKind=config.configuredKind;
  }catch(error){
    state.reason=sanitizeMessage(error instanceof Error?error.message:String(error),[workspaceRoot,thesisRoot]);
    config={configuredKind:"invalid",codexBin:"codex",cwd:workspaceRoot,sandbox:"workspace-write",model:null,workspaceRoot,thesisRoot};
  }
  if(["off","none","disabled"].includes(state.configuredKind)){
    state.reason="agent adapter is disabled; set RESEARCH_AGENT_ADAPTER=codex to enable dispatch";
  }else if(state.configuredKind!=="codex"){
    state.reason="unsupported agent adapter: "+state.configuredKind;
  }else if(!state.reason){
    try{
      const probe=spawnSyncImpl(config.codexBin,["--version"],{cwd:config.cwd,encoding:"utf8",timeout:5000,stdio:["ignore","pipe","pipe"]});
      if(probe?.error)throw probe.error;
      if(typeof probe?.status==="number"&&probe.status!==0)throw new Error("codex --version exited with "+probe.status);
      state.available=true;
      state.version=boundedText(probe?.stdout,160)??"codex";
    }catch(error){
      state.reason=sanitizeMessage(error instanceof Error?error.message:String(error),[workspaceRoot,thesisRoot]);
    }
  }
  function status(){
    return Object.freeze({
      schemaVersion:ADAPTER_SCHEMA_VERSION,kind:state.configuredKind,configured:state.configuredKind==="codex",
      available:state.available,enabled:state.configuredKind==="codex"&&state.available,busy:Boolean(state.activeTask),
      version:state.version,sandbox:config.sandbox,model:config.model??null,reason:state.reason,
      execution:state.available?"opt-in-ready":"prompt-intake-only",
      currentTask:publicTask(state.activeTask),lastTask:publicTask(state.lastTask)
    });
  }
  function emit(event){try{return onActivity(event)}catch{return null}}
  async function settle(task,finalState,error=null){
    if(task.settled)return;
    task.settled=true;task.state=finalState;task.completedAt=nowIso();
    task.error=error?sanitizeMessage(error,[workspaceRoot,thesisRoot]):null;
    if(state.activeTask===task)state.activeTask=null;
    state.lastTask=task;state.child=null;
    emit({
      type:finalState==="completed"?"task_completed":"task_failed",source:"codex-adapter",taskId:task.id,
      topicId:task.topicId,claimId:task.claimId,
      summary:finalState==="completed"?"Codex task completed":"Codex task failed"+(task.error?": "+task.error:"")
    });
    try{await onTaskSettled(publicTask(task))}catch{}
  }
  function handleEvent(task,event){
    if(!event||typeof event!=="object")return;
    if(event.type==="thread.started"&&typeof event.thread_id==="string"){
      task.threadId=event.thread_id;emit({type:"thread_started",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:"Codex thread "+event.thread_id});return;
    }
    if(event.type==="turn.started"){emit({type:"turn_started",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:"Codex turn started"});return}
    if(event.type==="turn.completed"){
      task.usage=normalizedUsage(event.usage??{});
      emit({type:"usage_updated",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:"Tokens · in "+task.usage.inputTokens+" · out "+task.usage.outputTokens,usage:task.usage});
      void settle(task,"completed");return;
    }
    if(event.type==="turn.failed"){void settle(task,"failed",event.error?.message??"Codex turn failed");return}
    if(event.type==="error"){void settle(task,"failed",event.message??"Codex stream error");return}
    const item=itemOf(event);if(!item)return;
    if(item.type==="reasoning")return;
    if(item.type==="agent_message"&&event.type==="item.completed"){
      const message=boundedText(item.text,12000);if(message){task.finalMessage=message;emit({type:"agent_message",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:boundedText(message.replace(/\s+/g," "),500),detail:message})}return;
    }
    if(item.type==="file_change"&&event.type==="item.completed"){
      for(const change of item.changes??[]){
        const mapped=semanticForFile(change.path,{cwd:config.cwd,workspaceRoot,thesisRoot,knowledge});if(!mapped)continue;
        emit({type:"file_edit",source:"codex-adapter",taskId:task.id,topicId:mapped.topicId??task.topicId,claimId:mapped.claimId??task.claimId,repository:mapped.repository,file:mapped.file,summary:"Codex "+(boundedText(change.kind,40)??"changed")+" "+path.posix.basename(mapped.file),detail:boundedText(change.diff,6000)});
      }return;
    }
    if(item.type==="mcp_tool_call"){
      const tool=[boundedText(item.server,80),boundedText(item.tool,120)].filter(Boolean).join("/");
      if(event.type==="item.started"){
        emit({type:"tool_started",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,tool,summary:"MCP "+(tool||"tool")+" started",detail:jsonDetail(item.arguments??item.tool_arguments??item.input,4000)});
        emit({type:"dependency_followed",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:"MCP "+(tool||"tool")});
      }else if(event.type==="item.completed"){
        emit({type:"tool_completed",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,tool,status:boundedText(item.status,80)??"completed",summary:"MCP "+(tool||"tool")+" completed",detail:jsonDetail(item.result??item.tool_result??item.output,6000)});
      }return;
    }
    if(item.type==="command_execution"){
      const command=boundedText(item.command,1200)??"";
      if(event.type==="item.started"){emit({type:"command_started",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,command,summary:command?"$ "+command:"Command started"});return}
      if(event.type!=="item.completed")return;
      const successful=item.exit_code==null?item.status==="completed":Number(item.exit_code)===0;
      emit({type:"command_completed",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,command,status:successful?"success":"failed",summary:"Command "+(successful?"completed":"failed")+(command?" · "+command:""),detail:boundedText(item.aggregated_output??item.aggregatedOutput??item.output,6000)});
      if(successful&&command){
        const milestone=/(^|\s)gh\s+pr\s+merge(?:\s|$)/i.test(command)?"pr_merged":/(^|\s)gh\s+pr\s+create(?:\s|$)/i.test(command)?"pr_created":/(^|\s)git\s+commit(?:\s|$)/i.test(command)?"commit_created":null;
        if(milestone)emit({type:milestone,source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:milestone==="commit_created"?"Git commit completed":milestone==="pr_created"?"GitHub pull request created":"GitHub pull request merged"});
      }return;
    }
    if(item.type==="web_search"){
      const query=boundedText(item.query,800);
      emit({type:event.type==="item.started"?"web_search_started":"web_search_completed",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:query?"Web search · "+query:"Web search",detail:event.type==="item.completed"?jsonDetail(item.results,6000):null});return;
    }
    if(item.type==="todo_list"&&event.type==="item.completed"){
      emit({type:"todo_updated",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:"Codex plan updated",detail:jsonDetail(item.items,6000)});
    }
  }
  function dispatch(request={}){
    if(!state.available){const e=new Error(state.reason||"agent adapter is unavailable");e.code="ADAPTER_UNAVAILABLE";throw e}
    if(state.activeTask){const e=new Error("agent is busy with "+state.activeTask.id);e.code="AGENT_BUSY";throw e}
    const prompt=boundedText(request.prompt,8*1024);if(!prompt){const e=new Error("prompt is required");e.code="INVALID_PROMPT";throw e}
    const task={
      id:"task:"+Date.now()+":"+(++state.counter),adapter:"codex",state:"starting",
      topicId:boundedText(request.topicId,128),claimId:boundedText(request.claimId,160),threadId:null,
      startedAt:nowIso(),completedAt:null,summary:boundedText(request.summary??prompt,220),error:null,finalMessage:null,usage:null,
      orchestration:request.orchestrationPlan??null,settled:false
    };
    state.activeTask=task;
    const args=["exec","--json","--skip-git-repo-check","--sandbox",config.sandbox,"--cd",config.cwd];
    if(config.model)args.push("--model",config.model);args.push("-");
    let child;
    try{child=spawnImpl(config.codexBin,args,{cwd:config.cwd,env,stdio:["pipe","pipe","pipe"],windowsHide:true})}
    catch(error){state.activeTask=null;task.state="failed";task.completedAt=nowIso();task.error=sanitizeMessage(error instanceof Error?error.message:String(error),[workspaceRoot,thesisRoot]);state.lastTask=task;const wrapped=new Error(task.error);wrapped.code="ADAPTER_SPAWN_FAILED";throw wrapped}
    state.child=child;task.state="running";
    emit({type:"task_started",source:"codex-adapter",taskId:task.id,topicId:task.topicId,claimId:task.claimId,summary:"Codex task started"});
    let stdoutBuffer="",stderrBuffer="";
    const consume=(line)=>{const text=String(line??"").trim();if(!text)return;try{handleEvent(task,JSON.parse(text))}catch{}};
    child.stdout?.setEncoding?.("utf8");
    child.stdout?.on?.("data",(chunk)=>{stdoutBuffer+=chunk;let idx;while((idx=stdoutBuffer.indexOf("\n"))>=0){consume(stdoutBuffer.slice(0,idx));stdoutBuffer=stdoutBuffer.slice(idx+1)}});
    child.stderr?.setEncoding?.("utf8");
    child.stderr?.on?.("data",(chunk)=>{if(stderrBuffer.length<4000)stderrBuffer+=String(chunk).slice(0,4000-stderrBuffer.length)});
    child.on?.("error",(error)=>void settle(task,"failed",error instanceof Error?error.message:String(error)));
    child.on?.("close",(code)=>{consume(stdoutBuffer);if(task.settled)return;if(Number(code)===0)void settle(task,"completed");else void settle(task,"failed",stderrBuffer||"codex exited with "+code)});
    child.stdin?.end?.(promptEnvelope({...request,prompt}));
    return publicTask(task);
  }
  function close(reason="Bridge stopped"){
    const task=state.activeTask;
    try{state.child?.kill?.("SIGTERM")}catch{}
    if(task&&!task.settled)void settle(task,"failed",reason);
  }
  return Object.freeze({status,dispatch,close});
}

export function agentAdapterStatus(env=process.env){
  const configured=(boundedText(env.RESEARCH_AGENT_ADAPTER,32)??"off").toLowerCase();
  return Object.freeze({enabled:configured==="codex",configured:configured==="codex",available:false,busy:false,execution:configured==="codex"?"requires-runtime-probe":"prompt-intake-only"});
}
