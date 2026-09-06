(function(){
"use strict";
var BASES=["http://127.0.0.1:18775","http://localhost:18775"];
var base=null,lastActivitySequence=0,lastActivity=null,currentChange=null,currentVerification=null,replaying=false;
var els={
  live:document.getElementById("liveLocal"),
  change:document.getElementById("changeIntelligence"),
  adapter:document.getElementById("agentAdapter"),
  orch:document.getElementById("orchestrationState"),
  verify:document.getElementById("verificationState"),
  agent:document.getElementById("agentActivity"),
  promptToggle:document.getElementById("promptToggle"),
  promptBar:document.getElementById("promptBar"),
  promptInput:document.getElementById("promptInput"),
  promptSubmit:document.getElementById("promptSubmit"),
  replayBar:document.getElementById("replayBar"),
  replaySlider:document.getElementById("replaySlider"),
  replayLabel:document.getElementById("replayLabel"),
  replayMeta:document.getElementById("replayMeta"),
  replayLive:document.getElementById("replayLive")
};
function api(path,options){return fetch(base+path,Object.assign({cache:"no-store"},options||{})).then(function(r){if(!r.ok)throw new Error(path+" "+r.status);return r.json()})}
function graphState(extra){
  var api3d=window.__RESEARCH_GRAPH_3D__;
  if(!api3d||!api3d.setLiveState)return;
  api3d.setLiveState(Object.assign({change:currentChange,verification:currentVerification,activityNodeId:lastActivity&&(lastActivity.claimId||lastActivity.topicId||(lastActivity.plan&&lastActivity.plan.topics&&lastActivity.plan.topics[0]))},extra||{}))
}
async function probe(){
  for(var i=0;i<BASES.length;i++){
    try{var r=await fetch(BASES[i]+"/api/health",{cache:"no-store"});if(r.ok){base=BASES[i];return true}}catch(_){}
  }
  return false
}
function show(el,value){if(!el)return;el.hidden=false;if(value!=null)el.textContent=value}
async function poll(){
  if(!base)return;
  try{
    var results=await Promise.all([
      api("/api/repository-status"),
      api("/api/change-intelligence"),
      api("/api/verification-state"),
      api("/api/agent-adapter"),
      api("/api/activity?after="+lastActivitySequence+"&limit=50"),
      api("/api/replay"),
      api("/api/viewer-settings")
    ]);
    var repos=results[0],change=results[1],verification=results[2],adapter=results[3],activity=results[4],replay=results[5],settings=results[6];
    currentChange=change;currentVerification=verification;
    show(els.live,"LIVE LOCAL · "+repos.dirtyCount+" dirty · "+repos.driftCount+" drift · "+repos.missingCount+" missing");
    if((change.changedEntityIds||[]).length||(change.impactedTopicIds||[]).length)show(els.change,"CHANGE · "+(change.changedEntityIds||[]).length+" changed · "+(change.impactedTopicIds||[]).length+" impacted");
    else if(els.change)els.change.hidden=true;
    show(els.adapter,"ADAPTER · "+(adapter.enabled?"ready":"off"));if(els.adapter)els.adapter.dataset.status=adapter.enabled?"ready":"unavailable";
    var latest=(activity.events||[]).slice(-1)[0];
    if(latest){lastActivity=latest;lastActivitySequence=Math.max(lastActivitySequence,latest.sequence||0);show(els.agent,"AGENT · "+latest.type+" · "+(latest.summary||""))}
    var failed=(verification.failedTargetIds||[]).length,running=(verification.runningTargetIds||[]).length,passed=(verification.passedTargetIds||[]).length;
    show(els.verify,"VERIFY · "+passed+" pass · "+running+" run · "+failed+" fail");
    if(replay.eventCount>0){
      els.replayBar.hidden=false;els.replaySlider.min=replay.earliestSequence;els.replaySlider.max=replay.latestSequence;
      if(!replaying)els.replaySlider.value=replay.latestSequence;
      els.replayMeta.textContent=replay.eventCount+" events · "+replay.checkpointCount+" checkpoints";
    }
    els.promptToggle.hidden=false;els.promptToggle.textContent=settings.promptEnabled?"Prompt ON":"Prompt OFF";els.promptBar.hidden=!settings.promptEnabled;
    graphState();
  }catch(_){if(els.live)els.live.textContent="LIVE LOCAL · reconnecting"}
}
async function setPrompt(enabled){
  var settings=await api("/api/viewer-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({promptEnabled:enabled})});
  els.promptToggle.textContent=settings.promptEnabled?"Prompt ON":"Prompt OFF";els.promptBar.hidden=!settings.promptEnabled;
}
if(els.promptToggle)els.promptToggle.addEventListener("click",function(){setPrompt(els.promptBar.hidden).catch(function(){})});
async function submitPrompt(){
  var prompt=(els.promptInput.value||"").trim();if(!prompt)return;
  els.promptSubmit.disabled=true;
  try{
    var result=await api("/api/prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:prompt})});
    els.promptInput.value="";show(els.orch,"ORCH · "+result.orchestration.mode+" · score "+result.orchestration.score);
    lastActivity=result.event;lastActivitySequence=Math.max(lastActivitySequence,result.event.sequence||0);poll();
  }finally{els.promptSubmit.disabled=false}
}
if(els.promptSubmit)els.promptSubmit.addEventListener("click",function(){submitPrompt().catch(function(){})});
if(els.promptInput)els.promptInput.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();submitPrompt().catch(function(){})}});
if(els.replaySlider)els.replaySlider.addEventListener("change",async function(){
  var seq=Number(els.replaySlider.value),timeline=await api("/api/replay");
  if(seq>=timeline.latestSequence){replaying=false;els.replayLabel.textContent="REPLAY · LIVE";els.replayLive.disabled=true;graphState();return}
  var frame=await api("/api/replay/frame?sequence="+seq);replaying=true;els.replayLabel.textContent="REPLAY · "+seq;els.replayLive.disabled=false;
  var ids=frame.checkpoint&&frame.checkpoint.historicalEntityIds||[];graphState({historicalEntityIds:ids});
});
if(els.replayLive)els.replayLive.addEventListener("click",function(){replaying=false;els.replayLabel.textContent="REPLAY · LIVE";els.replayLive.disabled=true;graphState({historicalEntityIds:[]})});
(async function(){if(await probe()){await poll();setInterval(poll,2200)}})();
}());