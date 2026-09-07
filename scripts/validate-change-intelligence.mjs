#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  collectGitChanges,
  diffSemanticSnapshots,
  diffSnapshots,
  mapGitChangesToSemantic,
  parseGitStatusPorcelain,
  researchChangeIntelligence,
  semanticSnapshot
} from "../intelligence/change-intelligence.mjs";
import { loadKnowledge } from "../intelligence/research-knowledge.mjs";

const parsed = parseGitStatusPorcelain(
  " M docs/thesis/a.md\0?? docs/thesis/b.md\0R  docs/thesis/new.md\0docs/thesis/old.md\0",
  { repositoryId: "thesis", repositoryName: "Three-Factor-Digital-Twin" }
);
assert.deepEqual(parsed.map((x) => [x.status, x.path, x.previousPath]), [
  ["M", "docs/thesis/a.md", null],
  ["A", "docs/thesis/b.md", null],
  ["R", "docs/thesis/new.md", "docs/thesis/old.md"]
]);

const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), "research-change-git-"));
try {
  const researchRoot = path.join(gitRoot, "ResearchWorkspace");
  const thesisRoot = path.join(gitRoot, "Three-Factor-Digital-Twin");
  for (const root of [researchRoot, thesisRoot]) {
    fs.mkdirSync(root, { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "ci@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CI"], { cwd: root });
    fs.writeFileSync(path.join(root, "base.txt"), "before\n");
    execFileSync("git", ["add", "base.txt"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "baseline"], { cwd: root });
  }
  fs.writeFileSync(path.join(researchRoot, "infra.txt"), "new\n");
  fs.mkdirSync(path.join(thesisRoot, "docs", "thesis"), { recursive: true });
  fs.writeFileSync(path.join(thesisRoot, "docs", "thesis", "thesis_sync_status_zh.md"), "sync\n");

  const fixtureKnowledge = {
    repositories: [
      { id: "research-workspace", name: "ResearchWorkspace" },
      { id: "thesis", name: "Three-Factor-Digital-Twin" }
    ]
  };
  const gitChanges = collectGitChanges({
    knowledge: fixtureKnowledge,
    repositoryRoots: {
      "research-workspace": researchRoot,
      thesis: thesisRoot
    }
  });
  assert.ok(gitChanges.some((x) => x.repositoryId === "research-workspace" && x.path === "infra.txt"));
  assert.ok(gitChanges.some((x) => x.repositoryId === "thesis" && x.path === "docs/thesis/thesis_sync_status_zh.md"));
} finally {
  fs.rmSync(gitRoot, { recursive: true, force: true });
}

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
assert.ok(Array.isArray(change.gitChanges));
assert.ok(Array.isArray(change.mappedGitChanges));
const mappedFixture = mapGitChangesToSemantic([
  { repositoryId: "research-workspace", repositoryName: "ResearchWorkspace", status: "M", path: "README.md", previousPath: null },
  { repositoryId: "thesis", repositoryName: "Three-Factor-Digital-Twin", status: "M", path: "docs/thesis/thesis_sync_status_zh.md", previousPath: null }
], { knowledge });
assert.equal(mappedFixture[0].mappingMode, "workspace-infrastructure");
assert.ok(mappedFixture[1].claimIds.includes("claim-sync"));
assert.equal(change.after.entityCount, current.entityCount);
assert.deepEqual(change.semanticDiff.changedEntityIds, []);

console.log("Research Change Intelligence v2 before/after semantic diff + source-to-Claim impact contract OK");
