import assert from "node:assert/strict";
import { loadKnowledge, knowledgeSummary } from "../intelligence/research-knowledge.mjs";
const k=loadKnowledge(),s=knowledgeSummary(k);
assert.equal(k.root.id,"thesis");
assert.ok(s.topics>=7);assert.ok(s.claims>=10);
assert.equal(new Set(k.topics.map(x=>x.id)).size,k.topics.length);
assert.equal(new Set(k.claims.map(x=>x.id)).size,k.claims.length);
assert.ok(k.claims.some(x=>x.status==="NOT_SUPPORTED"),"negative/missing evidence must remain visible");
console.log("ResearchWorkspace coordination graph OK",s);
