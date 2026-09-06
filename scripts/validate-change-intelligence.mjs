#!/usr/bin/env node
import assert from "node:assert/strict";
import { diffSnapshots, researchChangeIntelligence, semanticSnapshot } from "../intelligence/change-intelligence.mjs";
import { loadKnowledge } from "../intelligence/research-knowledge.mjs";

const knowledge=loadKnowledge();
const current=semanticSnapshot(knowledge);
assert.ok(current.entityIds.includes("claim-sync"));
const before={...current,entityIds:current.entityIds.filter((id)=>id!=="claim-sync")};
const diff=diffSnapshots(before,current);
assert.ok(diff.addedEntityIds.includes("claim-sync"),"semantic snapshot diff must retain stable Claim identity");

const change=researchChangeIntelligence({
  changedFiles:["docs/thesis/thesis_sync_status_zh.md"],
  knowledge,
  refreshIndex:false
});
assert.deepEqual(change.changedFiles,["docs/thesis/thesis_sync_status_zh.md"]);
assert.ok(change.sourceMapping.files.some((x)=>x.file==="docs/thesis/thesis_sync_status_zh.md"&&x.mappingMode==="registered"));
assert.ok(change.sourceMapping.entityIds.includes("claim-sync"));
assert.ok(change.directlyMappedClaimIds.includes("claim-sync"));
assert.ok(change.impactedClaimIds.includes("claim-sync"));
assert.ok(change.impactedTopicIds.includes("governance"));
assert.ok(change.changedEntityIds.includes("claim-sync"));
console.log("Research Change Intelligence source-to-Claim contract OK");
