import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadKnowledge, workspaceRoot } from "./research-knowledge.mjs";
import { thesisRoot } from "./source-index.mjs";

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding:"utf8", stdio:["ignore","pipe","ignore"] }).trim();
  } catch {
    return null;
  }
}

function changedFiles(cwd) {
  const raw = git(["status","--porcelain=v1","-z"], cwd);
  if (raw == null) return [];
  return raw.split("\0").filter(Boolean).map((entry) => entry.slice(3)).filter(Boolean);
}

export function repositoryStatus({ knowledge = loadKnowledge() } = {}) {
  return knowledge.repositories.map((repo) => {
    const cwd = repo.id === "thesis" ? thesisRoot() : workspaceRoot;
    const present = fs.existsSync(cwd) && fs.existsSync(path.join(cwd, ".git"));
    if (!present) {
      return { id:repo.id, name:repo.name, role:repo.role, pathPresent:false, branch:null, head:null, dirty:false, changedFiles:[], snapshotMatch:null };
    }
    const branch = git(["rev-parse","--abbrev-ref","HEAD"], cwd);
    const head = git(["rev-parse","HEAD"], cwd);
    const files = changedFiles(cwd);
    const expected = repo.id === "thesis" ? knowledge.snapshot.thesisCommit : null;
    return {
      id:repo.id,
      name:repo.name,
      role:repo.role,
      pathPresent:true,
      branch,
      head,
      dirty:files.length > 0,
      changedFiles:files,
      expectedHead:expected,
      snapshotMatch:expected ? head === expected : null
    };
  });
}

export function repositoryStatusSummary(options = {}) {
  const repositories = repositoryStatus(options);
  return {
    repositories,
    missingCount:repositories.filter((x) => !x.pathPresent).length,
    dirtyCount:repositories.filter((x) => x.dirty).length,
    driftCount:repositories.filter((x) => x.snapshotMatch === false).length
  };
}
