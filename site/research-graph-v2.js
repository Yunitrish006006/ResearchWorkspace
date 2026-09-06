(function(){
"use strict";
var DATA=window.__RESEARCH_GRAPH_DATA__;
var pane=document.getElementById("pane3d");
var canvas=document.getElementById("graph3d");
var info=document.getElementById("info");
if(!DATA||!canvas||!pane)return;

canvas.tabIndex=0;
canvas.setAttribute("role","application");
canvas.setAttribute("aria-label","ResearchWorkspace 3D research graph. Arrow keys select nodes, Enter or Space activates, left drag rotates, right drag pans, wheel zooms.");

var root=DATA.root;
var topics=DATA.topics||[];
var claims=DATA.claims||[];
var studies=DATA.studies||[];
var evidence=DATA.evidence||[];
var reviews=DATA.reviews||[];
var relations=DATA.relations||[];

var topicMap=new Map(topics.map(function(x){return[x.id,x]}));
var claimMap=new Map(claims.map(function(x){return[x.id,x]}));
var studyMap=new Map(studies.map(function(x){return[x.id,x]}));
var evidenceMap=new Map(evidence.map(function(x){return[x.id,x]}));
var reviewMap=new Map(reviews.map(function(x){return[x.id,x]}));

var edgeFilterKeys=["contains","supports","uses-method","grounded-in","validated-by","limits"];
var enabledEdgeFilters=new Set(edgeFilterKeys);
var expanded=new Set();
var spotlightId=null;
var keyboardFocusId=null;
var lastHits=[];
var pointers=new Map();
var cam={yaw:-0.48,pitch:0.22,zoom:1.02,panX:0,panY:0};
var gesture={pinching:false,startDistance:0,startZoom:1,lastCentroid:null,suppressClick:false};

document.getElementById("snapshot").textContent=(DATA.snapshot.date||"unknown")+" research snapshot";
document.getElementById("stats").textContent=topics.length+" topics｜"+claims.length+" claims｜"+studies.length+" studies｜"+evidence.length+" evidence｜"+reviews.length+" reviews";
var passCount=reviews.filter(function(x){return x.status==="PASS"}).length;
var failCount=reviews.filter(function(x){return x.status==="FAIL"}).length;
var warnCount=reviews.filter(function(x){return x.status==="WARN"}).length;
document.getElementById("verificationState").textContent="VERIFY "+passCount+" pass · "+warnCount+" warn · "+failCount+" pending";

function short(value,max){value=String(value||"");return value.length>max?value.slice(0,max-1)+"…":value}
function resize(){var dpr=window.devicePixelRatio||1;var rect=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr))}
function project(point,width,height){
  var cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
  var x=point.x*cy-point.z*sy;
  var z=point.x*sy+point.z*cy;
  var y=point.y*cp-z*sp;
  z=point.y*sp+z*cp;
  var scale=cam.zoom*820/Math.max(200,920+z);
  return{x:width/2+cam.panX+x*scale,y:height/2+cam.panY+y*scale,scale:scale,z:z}
}
function fib(index,count,radius){
  count=Math.max(1,count);
  var y=1-2*((index+0.5)/count);
  var ring=Math.sqrt(Math.max(0,1-y*y));
  var theta=index*Math.PI*(3-Math.sqrt(5));
  return{x:Math.cos(theta)*ring*radius,y:y*radius,z:Math.sin(theta)*ring*radius}
}
function hashUnit(text,salt){
  var h=(2166136261^(salt||0))>>>0;var value=String(text||"");
  for(var i=0;i<value.length;i+=1){h^=value.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  h^=h>>>16;h=Math.imul(h,2246822507)>>>0;h^=h>>>13;return(h>>>0)/4294967295
}
function scatter(parent,id,type,radius){
  var u=hashUnit(id,17),v=hashUnit(id,53),q=hashUnit(id,97);
  var zz=2*u-1,ring=Math.sqrt(Math.max(0,1-zz*zz)),theta=2*Math.PI*v;
  var band=type==="claim"?[0.56,0.90]:type==="study"?[0.42,0.72]:type==="evidence"?[0.52,0.84]:[0.58,0.88];
  var rr=radius*(band[0]+(band[1]-band[0])*q);
  return{x:parent.x+ring*Math.cos(theta)*rr,y:parent.y+zz*rr,z:parent.z+ring*Math.sin(theta)*rr}
}
function topicRadius(){var count=topics.filter(function(t){return expanded.has(t.id)}).length;return count?Math.min(610,430+Math.sqrt(count)*46):340}
function clusterRadius(ownerId){
  if(topicMap.has(ownerId)){var c=claims.filter(function(x){return x.ownerId===ownerId}).length;return Math.min(230,105+Math.sqrt(Math.max(1,c))*30)}
  if(claimMap.has(ownerId)){
    var n=studies.filter(function(x){return x.claimId===ownerId}).length+evidence.filter(function(x){return x.claimId===ownerId}).length+reviews.filter(function(x){return x.claimId===ownerId}).length;
    return Math.min(170,76+Math.sqrt(Math.max(1,n))*23)
  }
  return 100
}
function edgeVisible(edge){return !edge.type||enabledEdgeFilters.has(edge.type)}
function scene(){
  var nodes=[],edges=[],clusters=[];
  nodes.push({id:root.id,type:"root",label:root.name,position:{x:0,y:0,z:0},source:root,rank:0});
  var radius=topicRadius();
  topics.forEach(function(topic,index){
    var p=fib(index,topics.length,radius);
    nodes.push({id:topic.id,type:"topic",label:topic.name,position:p,source:topic,rank:topic.rankHint||1});
    edges.push({id:"contains:"+topic.id,from:root.id,to:topic.id,type:"contains",label:"contains"});
  });

  topics.forEach(function(topic){
    if(!expanded.has(topic.id))return;
    var parent=nodes.find(function(n){return n.id===topic.id});
    var owned=claims.filter(function(c){return c.ownerId===topic.id});
    clusters.push({ownerId:topic.id,radius:clusterRadius(topic.id),childCount:owned.length});
    owned.forEach(function(claim){
      var p=scatter(parent.position,claim.id,"claim",clusterRadius(topic.id));
      nodes.push({id:claim.id,type:"claim",label:claim.title,position:p,source:claim,ownerId:topic.id,rank:2});
      edges.push({id:"detail:"+claim.id,from:topic.id,to:claim.id,type:"contains",label:"claim"});
    });
  });

  claims.forEach(function(claim){
    if(!expanded.has(claim.id))return;
    var parent=nodes.find(function(n){return n.id===claim.id});
    if(!parent)return;
    var childCount=studies.filter(function(x){return x.claimId===claim.id}).length+evidence.filter(function(x){return x.claimId===claim.id}).length+reviews.filter(function(x){return x.claimId===claim.id}).length;
    clusters.push({ownerId:claim.id,radius:clusterRadius(claim.id),childCount:childCount});
    studies.filter(function(x){return x.claimId===claim.id}).forEach(function(item){
      var p=scatter(parent.position,item.id,"study",clusterRadius(claim.id));
      nodes.push({id:item.id,type:"study",label:item.title,position:p,source:item,ownerId:claim.id,rank:3});
      edges.push({id:"method:"+item.id,from:claim.id,to:item.id,type:"uses-method",label:item.kind||"study"});
    });
    evidence.filter(function(x){return x.claimId===claim.id}).forEach(function(item){
      var p=scatter(parent.position,item.id,"evidence",clusterRadius(claim.id));
      nodes.push({id:item.id,type:"evidence",label:item.title,position:p,source:item,ownerId:claim.id,rank:3});
      edges.push({id:"evidence:"+item.id,from:item.id,to:claim.id,type:"supports",label:item.evidenceClass||"evidence"});
    });
    reviews.filter(function(x){return x.claimId===claim.id}).forEach(function(item){
      var p=scatter(parent.position,item.id,"review",clusterRadius(claim.id));
      nodes.push({id:item.id,type:"review",label:item.title,position:p,source:item,ownerId:claim.id,rank:3});
      edges.push({id:"review:"+item.id,from:claim.id,to:item.id,type:"validated-by",label:item.status});
    });
  });

  relations.forEach(function(rel){
    if(!nodes.some(function(n){return n.id===rel.from})||!nodes.some(function(n){return n.id===rel.to}))return;
    edges.push({id:rel.id,from:rel.from,to:rel.to,type:rel.type,label:rel.label});
  });
  return{nodes:nodes,edges:edges.filter(edgeVisible),clusters:clusters}
}
function nodeColor(node){
  if(node.type==="root")return"#67e8f9";
  if(node.type==="topic")return"#60a5fa";
  if(node.type==="claim"){
    if(node.source.status==="NOT_SUPPORTED")return"#fb7185";
    if(node.source.status==="PARTIAL")return"#f59e0b";
    return"#fbbf24"
  }
  if(node.type==="study")return"#a78bfa";
  if(node.type==="evidence")return"#34d399";
  if(node.type==="review"){
    if(node.source.status==="FAIL")return"#fb7185";
    if(node.source.status==="WARN")return"#fbbf24";
    return"#4ade80"
  }
  return"#94a3b8"
}
function edgeColor(type){
  if(type==="contains")return"#60a5fa";
  if(type==="supports")return"#34d399";
  if(type==="uses-method")return"#a78bfa";
  if(type==="grounded-in")return"#22d3ee";
  if(type==="validated-by")return"#4ade80";
  if(type==="limits")return"#fb7185";
  return"#64748b"
}
function owner(node){return node?(node.ownerId||(node.type==="topic"?node.id:null)):null}
function relatedOwners(currentScene){
  var out=new Set();if(!spotlightId)return out;
  var byId=new Map(currentScene.nodes.map(function(n){return[n.id,n]}));
  currentScene.edges.forEach(function(edge){
    if(edge.from!==spotlightId&&edge.to!==spotlightId)return;
    var other=edge.from===spotlightId?edge.to:edge.from;
    var o=owner(byId.get(other));if(o)out.add(o)
  });
  return out
}
function connectedToSpotlight(currentScene,id){
  if(!spotlightId||id===spotlightId)return true;
  return currentScene.edges.some(function(e){return(e.from===spotlightId||e.to===spotlightId)&&(e.from===id||e.to===id)})
}
function drawArrowhead(ctx,a,b,color,alpha,width){
  var dx=b.x-a.x,dy=b.y-a.y,len=Math.sqrt(dx*dx+dy*dy);if(len<1)return;
  var ux=dx/len,uy=dy/len,size=Math.max(5,Math.min(9,5+width));
  var tx=b.x-ux*11,ty=b.y-uy*11;
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();
  ctx.moveTo(tx,ty);ctx.lineTo(tx-ux*size-uy*size*.7,ty-uy*size+ux*size*.7);ctx.lineTo(tx-ux*size+uy*size*.7,ty-uy*size-ux*size*.7);ctx.closePath();ctx.fill();ctx.restore()
}
function drawCluster(ctx,cluster,p,state){
  var radius=Math.max(42,cluster.radius*p.scale),color=topicMap.has(cluster.ownerId)?"#315f79":"#6b5ca5";
  ctx.save();ctx.globalAlpha=state==="dim"?.08:state==="active"?.28:.16;
  ctx.fillStyle=color;ctx.strokeStyle=state==="active"?"#e2f7ff":color;ctx.lineWidth=state==="active"?2:1;
  ctx.beginPath();ctx.ellipse(p.x,p.y,radius,radius*.48,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()
}
function draw(){
  if(pane.hidden)return;
  var rect=canvas.getBoundingClientRect(),width=rect.width,height=rect.height,dpr=window.devicePixelRatio||1;
  var ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  var current=scene(),projected=new Map();
  current.nodes.forEach(function(n){projected.set(n.id,project(n.position,width,height))});
  var byId=new Map(current.nodes.map(function(n){return[n.id,n]})),related=relatedOwners(current),spotlightOwner=owner(byId.get(spotlightId));

  current.clusters.forEach(function(cluster){
    var p=projected.get(cluster.ownerId);if(!p)return;
    var state=!spotlightId?"normal":cluster.ownerId===spotlightOwner?"active":related.has(cluster.ownerId)?"related":"dim";
    drawCluster(ctx,cluster,p,state)
  });

  var labels=[];
  current.edges.forEach(function(edge){
    var a=projected.get(edge.from),b=projected.get(edge.to);if(!a||!b)return;
    var active=!spotlightId||edge.from===spotlightId||edge.to===spotlightId;
    var color=edgeColor(edge.type),alpha=active?.78:.10,widthLine=active?1.7:.8;
    ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=widthLine;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalAlpha=1;
    drawArrowhead(ctx,a,b,color,alpha,widthLine);
    if(active&&spotlightId&&edge.label)labels.push({text:short(edge.label,34),x:(a.x+b.x)/2,y:(a.y+b.y)/2})
  });

  lastHits=[];
  current.nodes.slice().sort(function(a,b){return projected.get(a.id).z-projected.get(b.id).z}).forEach(function(node){
    var p=projected.get(node.id),selected=spotlightId===node.id||keyboardFocusId===node.id,connected=connectedToSpotlight(current,node.id);
    var child=node.type==="claim"||node.type==="study"||node.type==="evidence"||node.type==="review";
    var base=node.type==="root"?18:node.type==="topic"?13:node.type==="claim"?8:5.8;
    var radius=Math.max(child?4.4:8,base*p.scale),color=nodeColor(node);
    ctx.save();ctx.globalAlpha=spotlightId&&!connected?.15:1;
    if(selected||((node.type==="topic"||node.type==="claim")&&expanded.has(node.id))){
      ctx.strokeStyle=selected?"#fff":color;ctx.lineWidth=selected?2.8:2;ctx.beginPath();ctx.arc(p.x,p.y,radius+8,0,Math.PI*2);ctx.stroke()
    }
    ctx.shadowColor=color;ctx.shadowBlur=selected?18:8;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.font=(selected?"700 ":"")+"12px system-ui";ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillStyle=selected?"#fff":"#cfe0ec";
    ctx.fillText(short(node.label,32),p.x+radius+7,p.y);
    ctx.restore();
    lastHits.push({node:node,x:p.x,y:p.y,w:Math.max(32,radius*2+16),h:Math.max(32,radius*2+16),z:p.z})
  });
  labels.forEach(function(l){ctx.font="10px system-ui";ctx.fillStyle="#d9e8f0";ctx.textAlign="center";ctx.fillText(l.text,l.x,l.y-4)})
}
function hit(clientX,clientY){
  var rect=canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  var hits=lastHits.filter(function(h){return Math.abs(x-h.x)<=h.w/2&&Math.abs(y-h.y)<=h.h/2});
  hits.sort(function(a,b){return b.z-a.z});return hits[0]||null
}
function typeLabel(node){
  return node.type==="root"?"THESIS":node.type==="topic"?"TOPIC":node.type==="claim"?"CLAIM":node.type==="study"?"STUDY / METHOD":node.type==="evidence"?"EVIDENCE":"VERIFICATION"
}
function itemClass(status){return status==="PASS"||status==="SUPPORTED"?"ok":status==="FAIL"||status==="NOT_SUPPORTED"?"fail":"warn"}
function setInfo(node,sections){
  document.getElementById("infoType").textContent=typeLabel(node);
  document.getElementById("infoTitle").textContent=node.label;
  var src=node.source||{};
  document.getElementById("infoBody").textContent=src.summary||"";
  var html="";
  (sections||[]).forEach(function(section){
    if(!section.items||!section.items.length)return;
    html+="<h3>"+section.title+"</h3>";
    section.items.forEach(function(item){
      var cls=item.className?" "+item.className:"";
      html+="<div class=\"item"+cls+"\">"+item.text+"</div>"
    })
  });
  document.getElementById("infoContent").innerHTML=html;info.hidden=false
}
function showNode(node){
  keyboardFocusId=node.id;
  if(node.type==="topic"){
    if(expanded.has(node.id)){
      expanded.delete(node.id);
      claims.filter(function(c){return c.ownerId===node.id}).forEach(function(c){expanded.delete(c.id)})
    }else expanded.add(node.id)
  }else if(node.type==="claim"){
    if(expanded.has(node.id))expanded.delete(node.id);else expanded.add(node.id)
  }
  spotlightId=node.id;
  var src=node.source||{},sections=[];
  if(node.type==="root")sections=[
    {title:"Repositories",items:[
      {text:"Thesis: "+DATA.snapshot.thesisRepo+" @ "+DATA.snapshot.thesisCommit.slice(0,10)},
      {text:"3D interaction reference: "+DATA.snapshot.referenceRepo+" @ "+DATA.snapshot.referenceCommit.slice(0,10)}
    ]}
  ];
  if(node.type==="topic"){
    var owned=claims.filter(function(c){return c.ownerId===node.id});
    sections=[{title:"Semantic LOD",items:[{text:(expanded.has(node.id)?"Expanded":"Collapsed")+" · "+owned.length+" claims"}]},{title:"Claims",items:owned.map(function(c){return{text:c.title+" · "+c.status,className:itemClass(c.status)}})}]
  }
  if(node.type==="claim"){
    sections=[
      {title:"Claim status",items:[{text:src.status||"UNKNOWN",className:itemClass(src.status)}]},
      {title:"Evidence / studies",items:studies.filter(function(x){return x.claimId===node.id}).map(function(x){return{text:x.kind+" · "+x.title}}).concat(evidence.filter(function(x){return x.claimId===node.id}).map(function(x){return{text:x.evidenceClass+" · "+x.title}}))},
      {title:"Verification",items:reviews.filter(function(x){return x.claimId===node.id}).map(function(x){return{text:x.status+" · "+x.title,className:itemClass(x.status)}})}
    ]
  }
  if(node.type==="study")sections=[{title:"Kind",items:[{text:src.kind||"STUDY"}]}];
  if(node.type==="evidence")sections=[{title:"Evidence class",items:[{text:src.evidenceClass||"evidence"}]},{title:"Provenance",items:[{text:src.path||"—"}]}];
  if(node.type==="review")sections=[{title:"Status",items:[{text:src.status||"UNKNOWN",className:itemClass(src.status)}]}];
  setInfo(node,sections);draw()
}
function keyboardNodes(){return scene().nodes}
function moveKeyboard(step){
  var nodes=keyboardNodes();if(!nodes.length)return;
  var index=nodes.findIndex(function(n){return n.id===keyboardFocusId});if(index<0)index=0;
  index=(index+step+nodes.length)%nodes.length;keyboardFocusId=nodes[index].id;draw()
}
function panBy(dx,dy){
  var rect=canvas.getBoundingClientRect();
  var limX=Math.max(160,rect.width*.75),limY=Math.max(160,rect.height*.75);
  cam.panX=Math.max(-limX,Math.min(limX,cam.panX+dx));cam.panY=Math.max(-limY,Math.min(limY,cam.panY+dy))
}
function pointerCentroid(){var values=Array.from(pointers.values());if(!values.length)return null;return{x:values.reduce(function(s,p){return s+p.x},0)/values.length,y:values.reduce(function(s,p){return s+p.y},0)/values.length}}
function pointerDistance(){var values=Array.from(pointers.values());if(values.length<2)return 0;var dx=values[0].x-values[1].x,dy=values[0].y-values[1].y;return Math.sqrt(dx*dx+dy*dy)}
function resetView(){
  expanded.clear();spotlightId=null;keyboardFocusId=root.id;cam={yaw:-0.48,pitch:0.22,zoom:1.02,panX:0,panY:0};info.hidden=true;draw()
}
canvas.addEventListener("keydown",function(event){
  if(["ArrowRight","ArrowDown"].includes(event.key)){event.preventDefault();moveKeyboard(1)}
  else if(["ArrowLeft","ArrowUp"].includes(event.key)){event.preventDefault();moveKeyboard(-1)}
  else if(event.key==="Enter"||event.key===" "){event.preventDefault();var n=keyboardNodes().find(function(x){return x.id===keyboardFocusId});if(n)showNode(n)}
  else if(event.key==="Escape"){spotlightId=null;info.hidden=true;draw()}
  else if(event.key==="0"){resetView()}
});
canvas.addEventListener("focus",function(){if(!keyboardFocusId)keyboardFocusId=root.id;draw()});
canvas.addEventListener("contextmenu",function(event){event.preventDefault()});
canvas.addEventListener("pointerdown",function(event){
  var rect=canvas.getBoundingClientRect(),mode=event.pointerType==="mouse"&&event.button===2?"pan":"rotate";
  pointers.set(event.pointerId,{x:event.clientX-rect.left,y:event.clientY-rect.top,lastX:event.clientX-rect.left,lastY:event.clientY-rect.top,mode:mode});
  canvas.setPointerCapture(event.pointerId);canvas.classList.add("dragging");gesture.suppressClick=false;
  if(pointers.size===2){gesture.pinching=true;gesture.startDistance=pointerDistance();gesture.startZoom=cam.zoom;gesture.lastCentroid=pointerCentroid()}
});
canvas.addEventListener("pointermove",function(event){
  var rect=canvas.getBoundingClientRect(),p=pointers.get(event.pointerId);
  if(!p){canvas.style.cursor=hit(event.clientX,event.clientY)?"pointer":"grab";return}
  var x=event.clientX-rect.left,y=event.clientY-rect.top,dx=x-p.lastX,dy=y-p.lastY;p.x=x;p.y=y;p.lastX=x;p.lastY=y;pointers.set(event.pointerId,p);
  if(Math.abs(dx)+Math.abs(dy)>2)gesture.suppressClick=true;
  if(pointers.size>=2){
    var next=pointerCentroid(),dist=pointerDistance();
    if(next&&gesture.lastCentroid)panBy(next.x-gesture.lastCentroid.x,next.y-gesture.lastCentroid.y);
    if(gesture.startDistance>0)cam.zoom=Math.max(.32,Math.min(3.2,gesture.startZoom*(dist/gesture.startDistance)));
    gesture.lastCentroid=next
  }else if(p.mode==="pan"){panBy(dx,dy)}
  else{cam.yaw+=dx*.008;cam.pitch=Math.max(-1.28,Math.min(1.28,cam.pitch+dy*.008))}
  draw()
});
function endPointer(event){
  var wasClick=!gesture.suppressClick&&pointers.size===1,p=pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if(pointers.size<2){gesture.pinching=false;gesture.lastCentroid=null}
  if(!pointers.size)canvas.classList.remove("dragging");
  if(wasClick&&p){var rect=canvas.getBoundingClientRect(),h=hit(rect.left+p.x,rect.top+p.y);if(h)showNode(h.node)}
}
canvas.addEventListener("pointerup",endPointer);
canvas.addEventListener("pointercancel",function(event){pointers.delete(event.pointerId);if(!pointers.size)canvas.classList.remove("dragging")});
canvas.addEventListener("wheel",function(event){event.preventDefault();cam.zoom=Math.max(.32,Math.min(3.2,cam.zoom*Math.exp(-event.deltaY*.001)));draw()},{passive:false});

document.getElementById("overview").addEventListener("click",resetView);
document.getElementById("expandAll3d").addEventListener("click",function(){
  topics.forEach(function(t){expanded.add(t.id)});claims.forEach(function(c){expanded.add(c.id)});cam.zoom=.58;cam.panX=0;cam.panY=0;spotlightId=null;info.hidden=true;draw()
});
var edgeFilterButton=document.getElementById("edgeFilters"),edgeFilterPanel=document.getElementById("edgeFilterPanel");
edgeFilterButton.addEventListener("click",function(){var open=edgeFilterPanel.hidden;edgeFilterPanel.hidden=!open;edgeFilterButton.setAttribute("aria-expanded",open?"true":"false")});
function syncEdgeUi(){
  document.querySelectorAll("[data-edge-filter]").forEach(function(input){input.checked=enabledEdgeFilters.has(input.getAttribute("data-edge-filter"))});
  edgeFilterButton.textContent="線條 "+enabledEdgeFilters.size+"/"+edgeFilterKeys.length;draw()
}
document.querySelectorAll("[data-edge-filter]").forEach(function(input){input.addEventListener("change",function(){var key=input.getAttribute("data-edge-filter");if(input.checked)enabledEdgeFilters.add(key);else enabledEdgeFilters.delete(key);syncEdgeUi()})});
document.getElementById("edgeFilterAll").addEventListener("click",function(){enabledEdgeFilters=new Set(edgeFilterKeys);syncEdgeUi()});
document.getElementById("edgeFilterNone").addEventListener("click",function(){enabledEdgeFilters.clear();syncEdgeUi()});
document.getElementById("relations").addEventListener("click",function(){
  var pseudo={type:"root",label:"Research relation model",source:{summary:"ResearchWorkspace uses typed research relations rather than Totem module dependencies."}};
  setInfo(pseudo,[
    {title:"Core relations",items:[
      {text:"contains · Thesis / Topic / Claim hierarchy"},
      {text:"supports · Evidence → Claim"},
      {text:"uses-method · Claim → Study / Method"},
      {text:"grounded-in · Claim → bounded prerequisite"},
      {text:"validated-by · Claim → Verification / Review"},
      {text:"limits · contradiction, adverse result or missing evidence"}
    ]}
  ])
});
window.addEventListener("resize",function(){resize();draw()});
resize();keyboardFocusId=root.id;syncEdgeUi();draw();

window.__RESEARCH_GRAPH_3D__={scene:scene,reset:resetView,camera:cam,expanded:expanded};
}());