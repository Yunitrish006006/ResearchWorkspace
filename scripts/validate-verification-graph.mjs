import assert from "node:assert/strict";
import { buildVerificationGraph } from "../intelligence/verification-graph.mjs";
const g=buildVerificationGraph();
assert.ok(g.edges.some(x=>x.type==="validated-by"));
assert.ok(g.edges.some(x=>x.type==="supported-by"));
const causal=g.coverage.find(x=>x.claimId==="claim-causal");
assert.equal(causal.claimStatus,"NOT_SUPPORTED");
console.log("Claim Verification Graph OK");
