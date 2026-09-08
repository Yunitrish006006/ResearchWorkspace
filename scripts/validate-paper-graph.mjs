import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import {thesisRoot} from '../intelligence/source-index.mjs';
import path from 'node:path';
import {buildPaperGraph} from '../intelligence/paper-graph.mjs';
const graph=buildPaperGraph();
const byId=new Map(graph.nodes.map(n=>[n.id,n]));
assert.ok(graph.nodes.length>50);
assert.equal(byId.size,graph.nodes.length);
assert.ok(graph.nodes.filter(n=>!n.parentId).every(n=>n.kind==='paper'));
for(const n of graph.nodes) {
  if(n.parentId)assert.ok(byId.has(n.parentId),n.id);
  const seen=new Set(); let p=n;
  while(p) {assert.ok(!seen.has(p.id),`cycle ${p.id}`);seen.add(p.id);p=byId.get(p.parentId);}
}
for(const r of graph.relations) {
  assert.ok(byId.has(r.from)&&byId.has(r.to),r.id);
  if(r.type==='compares'&&r.metric) {
    assert.equal(r.outcome,r.ours<r.baseline?'BETTER':r.ours>r.baseline?'WORSE':'TIE');
    assert.ok(r.sourceLocator.path&&r.targetLocator.path);
    assert.ok(r.context.target);
  }
  if(r.type==='cites'&&r.sourceLocator)assert.ok(r.sourceLocator.line&&r.targetLocator.section);
}
const e15=graph.relations.filter(r=>r.type==='compares'&&r.context?.run);
assert.ok(e15.some(r=>r.context.run==='202308051757.csv'&&r.metric==='mae'&&r.outcome==='WORSE'));
assert.ok(e15.some(r=>r.context.run==='202310252230.csv'&&r.metric==='mae'&&r.outcome==='WORSE'));
assert.ok(graph.relations.some(r=>r.outcome==='NOT_COMPARABLE'));
assert.ok(graph.nodes.some(n=>n.status==='SOURCE_LOCATION_PENDING'));
assert.deepEqual(graph,buildPaperGraph());
const empty=fs.mkdtempSync(path.join(os.tmpdir(),'paper-graph-missing-'));
assert.equal(buildPaperGraph({root:empty}).nodes.length,0);
assert.ok(buildPaperGraph({root:empty}).warnings.length);
fs.rmdirSync(empty);
console.log(JSON.stringify({nodes:graph.nodes.length,relations:graph.relations.length,coverage:graph.coverage,warnings:graph.warnings}));

const manifest=path.join(thesisRoot(),'docs/research/published_graph_evidence.json');
if(fs.existsSync(manifest))for(const [original,entry] of Object.entries(JSON.parse(fs.readFileSync(manifest,'utf8')).files)){
 const bytes=fs.readFileSync(path.join(thesisRoot(),entry.path));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 assert.equal(bytes.length,entry.bytes);
}
