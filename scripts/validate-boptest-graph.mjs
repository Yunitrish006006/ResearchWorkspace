import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildPaperGraph} from '../intelligence/paper-graph.mjs';
import {thesisRoot} from '../intelligence/source-index.mjs';
const root=thesisRoot(),graph=buildPaperGraph();
const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
assert.equal(nodes.get('paper:boptest').parentId,'paper:main');
assert.equal(nodes.get('paper:boptest').status,'UNADOPTED_RESEARCH_EXTENSION');
assert.ok(graph.nodes.filter(n=>!n.parentId).every(n=>n.kind==='paper'));
assert.equal(graph.nodes.filter(n=>n.kind==='paper'&&n.id.startsWith('paper:boptest:literature:')).length,3);
const edges=graph.relations.filter(e=>e.id.startsWith('paper-edge:boptest:')&&e.type==='compares');
function value(loc){
  const d=JSON.parse(fs.readFileSync(path.join(root,loc.path),'utf8'));
  return loc.jsonPointer.slice(1).split('/').reduce((a,k)=>a[k],d);
}
for(const e of edges){
 assert.equal(e.ours,value(e.sourceLocator));assert.equal(e.baseline,value(e.targetLocator));
 assert.equal(e.outcome,e.ours<e.baseline?'BETTER':e.ours>e.baseline?'WORSE':'TIE');
 assert.ok(e.context.dataset&&e.context.target&&e.context.budget_h);
}
assert.ok(edges.some(e=>e.outcome==='WORSE'));
assert.ok(graph.nodes.some(n=>n.id==='paper:boptest:round:more-devices:apartment:fit:6'&&n.status==='NO_ADMISSIBLE_MODEL'));
for(const e of graph.relations.filter(e=>e.id.startsWith('paper-edge:boptest:')&&e.type==='cites')){
 assert.ok(e.sourceLocator.path&&e.sourceLocator.line&&e.targetLocator.section);
 assert.equal(nodes.get(e.to).status,'ABSTRACT_VERIFIED');
}
const registry=JSON.parse(fs.readFileSync(path.join(root,'docs/research/boptest_graph_sources.json'),'utf8'));
let expected=0;
for(const round of registry.rounds)for(const plant of round.plants){
 const file=path.join(root,'openspec/changes',round.change,'artifacts',plant+'.json');
 if(!fs.existsSync(file))continue;
 const r=JSON.parse(fs.readFileSync(file,'utf8'));
 expected+=r.evaluations.filter(e=>e.method===round.method).length*4;
}
if(registry.startupBoundaryStudy){
 const dir=path.join(root,'openspec/changes/startup-pi-boundary/artifacts');
 const v=JSON.parse(fs.readFileSync(path.join(dir,'verification.json')));
 for(const plant of Object.keys(v.plants))for(const phase of ['development','confirmation']){
  const r=JSON.parse(fs.readFileSync(path.join(dir,plant+'_'+phase+'.json')));
  expected+=r.evaluations.filter(e=>e.method!=='auto_pi').length*8;
 }
 assert.ok(graph.nodes.some(n=>n.status==='EXACT_REFERENCE_REUSE'));
}
if(registry.predictiveStartupStudy){
 const dir=path.join(root,'openspec/changes/predictive-startup-boundary/artifacts');
 const v=JSON.parse(fs.readFileSync(path.join(dir,'verification.json')));
 for(const plant of Object.keys(v.plants))for(const phase of ['development','confirmation']){
  const r=JSON.parse(fs.readFileSync(path.join(dir,plant+'_'+phase+'.json')));
  expected+=r.evaluations.filter(e=>e.method!=='auto_pi').length*8;
 }
}
if(registry.handoverAblationStudy){
 const dir=path.join(root,'openspec/changes/startup-handover-ablation/artifacts');
 const v=JSON.parse(fs.readFileSync(path.join(dir,'verification.json')));
 for(const plant of Object.keys(v.plants)){
  for(const phase of ['development','confirmation']){
   const r=JSON.parse(fs.readFileSync(path.join(dir,plant+'_'+phase+'.json')));
   expected+=r.evaluations.filter(e=>e.method!=='auto_pi').length*8;
  }
  expected+=v.plants[plant].factorial_contrasts.length*8;
 }
}
assert.equal(edges.length,expected,'Every completed comparison must retain its canonical metrics');
console.log(JSON.stringify({status:'PASS',controlComparisons:edges.length,literaturePapers:3,allEndpointValuesMatch:true}));

const groupData=registry.deviceGroupAnalysis&&JSON.parse(fs.readFileSync(path.join(root,registry.deviceGroupAnalysis)));
if(groupData){const features=graph.nodes.filter(n=>n.id.startsWith("paper:boptest:device-groups:")&&n.kind==="result");assert.equal(features.length,groupData.groups.length);for(const n of features)assert.deepEqual(JSON.parse(n.summary),value(n.locator));console.log("Device group features and all canonical pointers match");}
