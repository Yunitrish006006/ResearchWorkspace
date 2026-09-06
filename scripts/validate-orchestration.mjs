import assert from "node:assert/strict";
import { buildOrchestrationPlan, MAX_SUBAGENTS, MAX_PARALLEL_EXTRACTORS } from "../intelligence/orchestration-plan.mjs";
const a=buildOrchestrationPlan({query:"scope wording"});
assert.ok(["primary-only","assisted","bounded-parallel","guarded-parallel"].includes(a.mode));
for(const q of ["compare public benchmark hybrid residual and intervention evidence across thesis artifacts","causal control intervention public benchmark method verification synchronization"]){
 const p=buildOrchestrationPlan({query:q,changedTopics:["public","action","governance"],changedFiles:["docs/experiments/thesis_result_verification_zh.md"]});
 assert.ok(p.assignments.length<=MAX_SUBAGENTS);
 assert.ok(p.assignments.filter(x=>x.role==="evidence-extractor").length<=MAX_PARALLEL_EXTRACTORS);
 assert.ok(p.assignments.filter(x=>["literature-scout","methodology-analyst","independent-reviewer"].includes(x.role)).every(x=>x.access==="read-only"));
 assert.ok(p.assignments.filter(x=>x.role==="evidence-extractor").every(x=>x.scope.length<=1));
}
console.log("Adaptive research orchestration OK");
