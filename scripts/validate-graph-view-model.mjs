import assert from "node:assert/strict";
import { buildGraphViewModel } from "../intelligence/graph-view-model.mjs";
const model=buildGraphViewModel();
assert.equal(model.schemaVersion,2);
assert.ok(model.snapshot.thesisCommit);
assert.ok(model.snapshot.auditedThesisCommit);
assert.equal(typeof model.snapshot.thesisSnapshotDrift,"boolean");
assert.equal(typeof model.snapshot.thesisDirty,"boolean");
console.log("Graph view model carries audited/current thesis snapshot state");
