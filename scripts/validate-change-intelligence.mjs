import assert from "node:assert/strict";
import { researchChangeIntelligence, semanticSnapshot, diffSnapshots } from "../intelligence/change-intelligence.mjs";
const snap=semanticSnapshot();
assert.deepEqual(diffSnapshots(snap,snap).addedEntityIds,[]);
const change=researchChangeIntelligence({changedFiles:["docs/thesis/thesis_sync_status_zh.md"]});
assert.ok(change.impactedClaimIds.includes("claim-sync"));
assert.ok(change.impactedTopicIds.includes("governance"));
console.log("Research Change Intelligence OK");
