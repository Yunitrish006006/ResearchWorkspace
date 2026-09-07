#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  diffSemanticSnapshots,
  diffSnapshots,
  researchChangeIntelligence,
  semanticSnapshot
} from "../intelligence/change-intelligence.mjs";
import { loadKnowledge } from "../intelligence/research-knowledge.mjs";

const knowledge = loadKnowledge();
const current = semanticSnapshot(knowledge);
assert.equal(current.schemaVersion, 2);
assert.ok(current.entityIds.includes("claim-sync"));
assert.equal(current.entityCount, current.entities.length);
assert.ok(current.entities.some((x) => x.id === "claim-sync" && x.type === "claim"));
assert.ok(current.relations.every((x) => typeof x.fingerprint === "string"));

const before = {
  ...current,
  entities: current.entities.map((entry) =>
    entry.id === "claim-sync"
      ? { ...entry, fingerprint: entry.fingerprint + ":old" }
      : entry
  ),
  entityIds: current.entityIds
};
const semanticDiff = diffSemanticSnapshots(before, current);
assert.ok(semanticDiff.modifiedEntityIds.includes("claim-sync"),
  "stable Claim identity must report semantic modification instead of add/remove");

const compatibility = diffSnapshots(
  { entityIds: current.entityIds.filter((id) => id !== "claim-sync"), relationIds: current.relationIds },
  current
);
assert.ok(compatibility.addedEntityIds.includes("claim-sync"),
  "legacy ID-only snapshots must remain diff-compatible");

const change = researchChangeIntelligence({
  changedFiles: ["docs/thesis/thesis_sync_status_zh.md"],
  knowledge,
  refreshIndex: false,
  before: current
});
assert.equal(change.schemaVersion, 2);
assert.deepEqual(change.changedFiles, ["docs/thesis/thesis_sync_status_zh.md"]);
assert.ok(change.sourceMapping.files.some((x) =>
  x.file === "docs/thesis/thesis_sync_status_zh.md" &&
  x.mappingMode === "registered"));
assert.ok(change.sourceMapping.entityIds.includes("claim-sync"));
assert.ok(change.directlyMappedClaimIds.includes("claim-sync"));
assert.ok(change.impactedClaimIds.includes("claim-sync"));
assert.ok(change.impactedTopicIds.includes("governance"));
assert.ok(change.changedEntityIds.includes("claim-sync"));
assert.ok(change.affectedEntityIds.includes("governance"));
assert.ok(change.before && change.after);
assert.equal(change.after.entityCount, current.entityCount);
assert.deepEqual(change.semanticDiff.changedEntityIds, []);

console.log("Research Change Intelligence v2 before/after semantic diff + source-to-Claim impact contract OK");
