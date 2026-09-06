(function(){
"use strict";
var BASES=["http://127.0.0.1:18775","http://localhost:18775"];
var base=null,lastActivitySequence=0,lastActivity=null,currentChange=null,currentVerification=null,replaying=false;
var conversationRevision=0,conversationClientId="legacy:"+Date.now(),draftTimer=null;
var conversationPrivate=["127.0.0.1","localhost","::1"].indexOf(location.hostname.toLowerCase())>=0;
var els={
  live:document.getElementById("liveLocal"),
  change:document.getElementById("changeIntelligence"),
  adapter:document.getElementById("agentAdapter"),
  orch:document.getElementById("orchestrationState"),
  verify:document.getElementById("verificationState"),
  artifact:document.getElementById("artifactDrift"),
  agent:document.getElementById("agentActivity"),
  promptToggle:document.getElementById("promptToggle"),
  promptBar:document.getElementById("promptBar"),
  promptInput:document.getElementById("promptInput"),
  promptSubmit:document.getElementById("promptSubmit"),
  conversationToggle:document.getElementById("conversationToggle"),
  conversationPanel:document.getElementById("conversationPanel"),
  conversationClose:document.getElementById("conversationClose"),
  conversationDraft:document.getElementById("conversationDraft"),
  conversationEntries:document.getElementById("conversationEntries"),
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
function escapeHtml(value){
  return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})
}
function renderConversation(snapshot){
  if(!els.conversationPanel)return;
  conversationRevision=Math.max(conversationRevision,Number(snapshot.latestRevision||0));
  var draft=snapshot.draft;
  if(draft&&draft.clientId!==conversationClientId&&String(draft.text||"").trim()){
    els.conversationDraft.hidden=false;
    els.conversationDraft.innerHTML="<b>REMOTE DRAFT</b><br>"+escapeHtml(draft.text);
  }else els.conversationDraft.hidden=true;
  var entries=snapshot.entries||[];
  if(entries.length){
    var current=els.conversationEntries.dataset.entries?JSON.parse(els.conversationEntries.dataset.entries):[];
    var seen=new Set(current.map(function(x){return x.revision}));
    entries.forEach(function(entry){if(!seen.has(entry.revision))current.push(entry)});
    current.sort(function(a,b){return a.revision-b.revision});
    if(current.length>120)current=current.slice(-120);
    els.conversationEntries.dataset.entries=JSON.stringify(current);
    els.conversationEntries.innerHTML=current.slice().reverse().map(function(entry){
      var cls="conversation-entry "+(entry.kind==="prompt"?"prompt ":"")+(entry.status==="failed"?"failed":"");
      return '<div class="'+cls+'"><div class="meta"><span>'+escapeHtml((entry.source||"workspace")+" · "+(entry.kind||"status"))+'</span><span>#'+Number(entry.revision||0)+'</span></div><div class="text">'+escapeHtml(entry.text||"")+'</div></div>';
    }).join("");
  }
}
async function pollConversation(){
  if(!base||!conversationPrivate)return;
  try{
    var snapshot=await api("/api/conversation?after="+conversationRevision);
    renderConversation(snapshot);
    if(els.conversationToggle)els.conversationToggle.hidden=false;
  }catch(_){}
}
async function syncDraft(){
  if(!base||!conversationPrivate||!els.promptInput)return;
  try{await api("/api/conversation/draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:conversationClientId,text:els.promptInput.value||""})})}catch(_){}
}
async function poll(){
  if(!base)return;
  try{
    var results=await Promise.all([
      api("/api/graph-data"),
      api("/api/repository-status"),
      api("/api/change-intelligence"),
      api("/api/verification-state"),
      api("/api/artifact-drift"),
      api("/api/agent-adapter"),
      api("/api/activity?after="+lastActivitySequence+"&limit=50"),
      api("/api/replay"),
      api("/api/viewer-settings")
    ]);
    var graphData=results[0],repos=results[1],change=results[2],verification=results[3],artifact=results[4],adapter=results[5],activity=results[6],replay=results[7],settings=results[8];
    var graphApi=window.__RESEARCH_GRAPH_3D__;
    if(graphApi&&graphApi.replaceData)graphApi.replaceData(graphData);
    currentChange=change;currentVerification=verification;
    show(els.live,"LIVE LOCAL · "+repos.dirtyCount+" dirty · "+repos.driftCount+" drift · "+repos.missingCount+" missing");
    if((change.changedEntityIds||[]).length||(change.impactedTopicIds||[]).length)show(els.change,"CHANGE · "+(change.changedEntityIds||[]).length+" changed · "+(change.impactedTopicIds||[]).length+" impacted");
    else if(els.change)els.change.hidden=true;
    show(els.adapter,"ADAPTER · "+(adapter.enabled?"ready":"off"));if(els.adapter)els.adapter.dataset.status=adapter.enabled?"ready":"unavailable";
    var latest=(activity.events||[]).slice(-1)[0];
    if(latest){lastActivity=latest;lastActivitySequence=Math.max(lastActivitySequence,latest.sequence||0);show(els.agent,"AGENT · "+latest.type+" · "+(latest.summary||""))}
    var failed=(verification.failedTargetIds||[]).length,running=(verification.runningTargetIds||[]).length,passed=(verification.passedTargetIds||[]).length;
    show(els.verify,"VERIFY · "+passed+" pass · "+running+" run · "+failed+" fail");
    if(artifact&&artifact.driftCount>0){show(els.artifact,"ARTIFACT · "+artifact.driftCount+" drift");els.artifact.title=(artifact.findings||[]).map(function(x){return x.message}).join("\n")}else if(els.artifact)els.artifact.hidden=true;
    if(replay.eventCount>0){
      els.replayBar.hidden=false;els.replaySlider.min=replay.earliestSequence;els.replaySlider.max=replay.latestSequence;
      if(!replaying)els.replaySlider.value=replay.latestSequence;
      els.replayMeta.textContent=replay.eventCount+" events · "+replay.checkpointCount+" checkpoints";
    }
    els.promptToggle.hidden=false;els.promptToggle.textContent=settings.promptEnabled?"Prompt ON":"Prompt OFF";els.promptBar.hidden=!settings.promptEnabled;
    if(conversationPrivate)pollConversation();
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
    els.promptInput.value="";if(conversationPrivate)syncDraft();show(els.orch,"ORCH · "+result.orchestration.mode+" · score "+result.orchestration.score);
    lastActivity=result.event;lastActivitySequence=Math.max(lastActivitySequence,result.event.sequence||0);poll();
  }finally{els.promptSubmit.disabled=false}
}
if(els.promptSubmit)els.promptSubmit.addEventListener("click",function(){submitPrompt().catch(function(){})});
if(els.promptInput){
  els.promptInput.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();submitPrompt().catch(function(){})}});
  els.promptInput.addEventListener("input",function(){if(!conversationPrivate)return;clearTimeout(draftTimer);draftTimer=setTimeout(syncDraft,350)});
}
if(els.conversationToggle)els.conversationToggle.addEventListener("click",function(){els.conversationPanel.hidden=!els.conversationPanel.hidden});
if(els.conversationClose)els.conversationClose.addEventListener("click",function(){els.conversationPanel.hidden=true});
if(els.replaySlider)els.replaySlider.addEventListener("change",async function(){
  var seq=Number(els.replaySlider.value),timeline=await api("/api/replay");
  if(seq>=timeline.latestSequence){replaying=false;els.replayLabel.textContent="REPLAY · LIVE";els.replayLive.disabled=true;graphState();return}
  var frame=await api("/api/replay/frame?sequence="+seq);replaying=true;els.replayLabel.textContent="REPLAY · "+seq;els.replayLive.disabled=false;
  var ids=frame.checkpoint&&frame.checkpoint.historicalEntityIds||[];graphState({historicalEntityIds:ids});
});
if(els.replayLive)els.replayLive.addEventListener("click",function(){replaying=false;els.replayLabel.textContent="REPLAY · LIVE";els.replayLive.disabled=true;graphState({historicalEntityIds:[]})});
(async function(){if(await probe()){await poll();if(conversationPrivate){await pollConversation();setInterval(pollConversation,1200)}setInterval(poll,2200)}})();
}());