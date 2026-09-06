import assert from "node:assert/strict";
import { loadKnowledge } from "../intelligence/research-knowledge.mjs";
import { buildGeneratedSourceLayer } from "../intelligence/source-layer.mjs";
const knowledge=loadKnowledge();
const path="openspec/specs/research-contract/spec.md";
const index={
  rootPresent:true,
  fileRecords:[{path,sha256:"abc",chunkCount:1}],
  chunks:[{id:"x",repository:"thesis",path,startLine:1,endLine:1,sha256:"abc",text:"research contract primary estimator three factor scope"}]
};
const layer=buildGeneratedSourceLayer({knowledge,index});
assert.equal(layer.sourceIndexed,true);
assert.ok(layer.artifacts.some(x=>x.claimId==="claim-primary"&&x.path===path));
assert.ok(layer.areas.some(x=>x.claimId==="claim-primary"&&x.family==="openspec"));
assert.ok(layer.artifacts.every(x=>x.mappingConfidence>=.65));
console.log("Generated source-detail L3/L4 layer OK");
