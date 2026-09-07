import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { impactAnalysis, loadKnowledge, workspaceRoot } from "./research-knowledge.mjs";
import { repositoryStatusSummary } from "./repository-status.mjs";
import { loadSourceIndex, refreshSourceIndex } from "./source-index.mjs";
import { mappedImpactSurface } from "./source-mapping.mjs";
import { buildGraphViewModel } from "./graph-view-model.mjs";

const statePath = path.join(workspaceRoot, ".research-index", "change-intelligence.json");

function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return null;
  }
}

export function parseGitStatusPorcelain(
  raw,
  { repositoryId = "unknown", repositoryName = repositoryId } = {}
) {
  const parts = String(raw ?? "").split("\0");
  const changes = [];
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i];
    if (!entry || entry.length < 3) continue;
    const xy = entry.slice(0, 2);
    const pathValue = entry.slice(3);
    if (!pathValue) continue;
    const primary = xy[0] !== " " ? xy[0] : xy[1];
    const renamed = xy.includes("R") || xy.includes("C");
    const previousPath = renamed ? (parts[++i] || null) : null;
    changes.push(Object.freeze({
      repositoryId,
      repositoryName,
      status: primary === "?" && xy === "??" ? "A" : primary,
      indexStatus: xy[0],
      worktreeStatus: xy[1],
      path: pathValue.replaceAll("\\", "/"),
      previousPath: previousPath?.replaceAll("\\", "/") ?? null
    }));
  }
  return changes;
}

export function collectGitChanges({
  knowledge = loadKnowledge(),
  repositoryRoots = null
} = {}) {
  const roots = repositoryRoots ?? {
    "research-workspace": workspaceRoot,
    thesis: (() => {
      const status = repositoryStatusSummary({ knowledge }).repositories
        .find((x) => x.id === "thesis");
      if (!status?.pathPresent) return null;
      return process.env.RESEARCH_THESIS_REPO
        ? path.resolve(process.env.RESEARCH_THESIS_REPO)
        : path.resolve(workspaceRoot, "..", "Three-Factor-Digital-Twin");
    })()
  };
  const results = [];
  for (const repository of knowledge.repositories) {
    const cwd = roots[repository.id];
    if (!cwd || !fs.existsSync(path.join(cwd, ".git"))) continue;
    const raw = git(["status", "--porcelain=v1", "-z"], cwd);
    if (raw == null) continue;
    results.push(...parseGitStatusPorcelain(raw, {
      repositoryId: repository.id,
      repositoryName: repository.name
    }));
  }
  return results;
}

export function mapGitChangesToSemantic(
  gitChanges,
  { knowledge = loadKnowledge(), index = loadSourceIndex() } = {}
) {
  return gitChanges.map((change) => {
    if (change.repositoryId !== "thesis") {
      return Object.freeze({
        ...change,
        entityIds: [],
        claimIds: [],
        topicIds: [],
        mappingMode: "workspace-infrastructure"
      });
    }
    const surface = mappedImpactSurface([change.path], { knowledge, index });
    const file = surface.files[0];
    return Object.freeze({
      ...change,
      entityIds: surface.entityIds,
      claimIds: surface.claimIds,
      topicIds: surface.topicIds,
      mappingMode: file?.mappingMode ?? "unmapped"
    });
  });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => typeof item !== "function")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(stableValue(value));
}

function graphFrom(input) {
  if (
    input &&
    input.root &&
    Array.isArray(input.topics) &&
    Array.isArray(input.claims)
  ) return input;
  return buildGraphViewModel(input ?? loadKnowledge());
}

function entity(type, value, ownerIds = []) {
  return Object.freeze({
    id: value.id,
    type,
    ownerIds: [...new Set(ownerIds.filter(Boolean))].sort(),
    fingerprint: fingerprint(value)
  });
}

function entitiesForGraph(graph) {
  const claimById = new Map((graph.claims ?? []).map((x) => [x.id, x]));
  const areaById = new Map((graph.sourceAreas ?? []).map((x) => [x.id, x]));
  return [
    entity("root", graph.root, []),
    ...(graph.topics ?? []).map((x) => entity("topic", x, [graph.root.id])),
    ...(graph.claims ?? []).map((x) => entity("claim", x, [x.ownerId])),
    ...(graph.studies ?? []).map((x) => {
      const claim = claimById.get(x.claimId);
      return entity("study", x, [x.claimId, claim?.ownerId]);
    }),
    ...(graph.evidence ?? []).map((x) => {
      const claim = claimById.get(x.claimId);
      return entity("evidence", x, [x.claimId, claim?.ownerId]);
    }),
    ...(graph.reviews ?? []).map((x) => {
      const claim = claimById.get(x.claimId);
      return entity("review", x, [x.claimId, claim?.ownerId]);
    }),
    ...(graph.sourceAreas ?? []).map((x) => {
      const claim = claimById.get(x.claimId);
      return entity("source-area", x, [x.claimId, claim?.ownerId]);
    }),
    ...(graph.artifacts ?? []).map((x) => {
      const area = areaById.get(x.areaId);
      const claim = claimById.get(x.claimId ?? area?.claimId);
      return entity("artifact", x, [x.areaId, x.claimId ?? area?.claimId, claim?.ownerId]);
    })
  ].sort((a, b) => a.id.localeCompare(b.id));
}

function relationsForGraph(graph) {
  return (graph.relations ?? [])
    .map((relation) => Object.freeze({
      id: relation.id,
      type: relation.type,
      from: relation.from,
      to: relation.to,
      fingerprint: fingerprint(relation)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function semanticSnapshot(input = loadKnowledge()) {
  const graph = graphFrom(input);
  const entities = entitiesForGraph(graph);
  const relations = relationsForGraph(graph);
  return Object.freeze({
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    entities,
    relations,
    entityIds: entities.map((x) => x.id),
    relationIds: relations.map((x) => x.id),
    entityCount: entities.length,
    relationCount: relations.length
  });
}

function legacyEntities(snapshot) {
  if (Array.isArray(snapshot?.entities)) return snapshot.entities;
  return (snapshot?.entityIds ?? []).map((id) => ({
    id,
    type: "unknown",
    ownerIds: [],
    fingerprint: null
  }));
}

function legacyRelations(snapshot) {
  if (Array.isArray(snapshot?.relations)) return snapshot.relations;
  return (snapshot?.relationIds ?? []).map((id) => ({
    id,
    type: "unknown",
    from: null,
    to: null,
    fingerprint: null
  }));
}

function diffEntries(beforeEntries, afterEntries) {
  const before = new Map(beforeEntries.map((x) => [x.id, x]));
  const after = new Map(afterEntries.map((x) => [x.id, x]));
  const added = [...after.values()].filter((x) => !before.has(x.id));
  const removed = [...before.values()].filter((x) => !after.has(x.id));
  const modified = [...after.values()]
    .filter((x) => {
      const prior = before.get(x.id);
      return prior && prior.fingerprint !== null && x.fingerprint !== null &&
        prior.fingerprint !== x.fingerprint;
    })
    .map((x) => ({ ...x, before: before.get(x.id) }));
  return { added, removed, modified };
}

export function diffSemanticSnapshots(before, after) {
  const entityDiff = diffEntries(legacyEntities(before), legacyEntities(after));
  const relationDiff = diffEntries(legacyRelations(before), legacyRelations(after));
  return Object.freeze({
    added: entityDiff.added,
    removed: entityDiff.removed,
    modified: entityDiff.modified,
    addedRelations: relationDiff.added,
    removedRelations: relationDiff.removed,
    modifiedRelations: relationDiff.modified,
    addedEntityIds: entityDiff.added.map((x) => x.id),
    removedEntityIds: entityDiff.removed.map((x) => x.id),
    modifiedEntityIds: entityDiff.modified.map((x) => x.id),
    addedRelationIds: relationDiff.added.map((x) => x.id),
    removedRelationIds: relationDiff.removed.map((x) => x.id),
    modifiedRelationIds: relationDiff.modified.map((x) => x.id),
    changedEntityIds: [...new Set([
      ...entityDiff.added.map((x) => x.id),
      ...entityDiff.removed.map((x) => x.id),
      ...entityDiff.modified.map((x) => x.id)
    ])],
    changedRelationIds: [...new Set([
      ...relationDiff.added.map((x) => x.id),
      ...relationDiff.removed.map((x) => x.id),
      ...relationDiff.modified.map((x) => x.id)
    ])]
  });
}

export function diffSnapshots(before, after) {
  const diff = diffSemanticSnapshots(before, after);
  return Object.freeze({
    addedEntityIds: diff.addedEntityIds,
    removedEntityIds: diff.removedEntityIds,
    modifiedEntityIds: diff.modifiedEntityIds,
    addedRelationIds: diff.addedRelationIds,
    removedRelationIds: diff.removedRelationIds,
    modifiedRelationIds: diff.modifiedRelationIds,
    changedEntityIds: diff.changedEntityIds,
    changedRelationIds: diff.changedRelationIds
  });
}

export function loadResearchChangeIntelligence() {
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

export function saveResearchChangeIntelligence(value) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(value, null, 2) + "\n");
  return value;
}

export function researchChangeIntelligence({
  changedFiles = null,
  changedTopics = [],
  before = null,
  knowledge = loadKnowledge(),
  persist = false,
  refreshIndex = true
} = {}) {
  const repositoryStatus = repositoryStatusSummary({ knowledge });
  const thesis = repositoryStatus.repositories.find((x) => x.id === "thesis");
  const gitChanges = collectGitChanges({ knowledge });
  const thesisGitChanges = gitChanges.filter((x) => x.repositoryId === "thesis");
  const effectiveFiles = changedFiles?.length
    ? changedFiles
    : thesisGitChanges.length
      ? thesisGitChanges.map((x) => x.path)
      : (thesis?.changedFiles ?? []);

  let index = loadSourceIndex();
  let indexRefresh = { mode: "fresh", refreshedFiles: [], removedFiles: [] };
  if (refreshIndex && effectiveFiles.length) {
    const refreshed = refreshSourceIndex({ files: effectiveFiles, index });
    index = refreshed.index;
    indexRefresh = {
      mode: refreshed.mode,
      refreshedFiles: refreshed.refreshedFiles,
      removedFiles: refreshed.removedFiles
    };
  }

  const sourceMapping = mappedImpactSurface(effectiveFiles, { knowledge, index });
  const mappedGitChanges = mapGitChangesToSemantic(gitChanges, { knowledge, index });
  const mappedClaims = sourceMapping.claimIds;
  const mappedTopics = [...new Set([...changedTopics, ...sourceMapping.topicIds])];

  const after = semanticSnapshot(knowledge);
  const stored = loadResearchChangeIntelligence();
  const previous = before ?? stored?.after ?? stored?.snapshot ?? null;
  const semanticDiff = previous
    ? diffSemanticSnapshots(previous, after)
    : {
        added: [], removed: [], modified: [],
        addedRelations: [], removedRelations: [], modifiedRelations: [],
        addedEntityIds: [], removedEntityIds: [], modifiedEntityIds: [],
        addedRelationIds: [], removedRelationIds: [], modifiedRelationIds: [],
        changedEntityIds: [], changedRelationIds: []
      };

  const directImpact = impactAnalysis(
    { changedFiles: effectiveFiles, changedTopics: mappedTopics },
    knowledge
  );
  const impactedClaims = new Set([
    ...directImpact.impactedClaimIds,
    ...mappedClaims
  ]);

  let propagated = true;
  while (propagated) {
    propagated = false;
    for (const rel of knowledge.relations) {
      if (
        (impactedClaims.has(rel.from) || impactedClaims.has(rel.to)) &&
        !(impactedClaims.has(rel.from) && impactedClaims.has(rel.to))
      ) {
        const candidate = impactedClaims.has(rel.from) ? rel.to : rel.from;
        if (knowledge.claimById.has(candidate)) {
          impactedClaims.add(candidate);
          propagated = true;
        }
      }
    }
  }

  const impactedTopicIds = [...new Set([
    ...mappedTopics,
    ...[...impactedClaims]
      .map((id) => knowledge.claimById.get(id)?.ownerId)
      .filter(Boolean)
  ])];

  const changedEntityIds = [...new Set([
    ...semanticDiff.changedEntityIds,
    ...sourceMapping.entityIds,
    ...directImpact.directClaimIds
  ])];
  const affectedEntityIds = [...new Set([
    ...changedEntityIds,
    ...impactedClaims,
    ...impactedTopicIds
  ])];

  const result = Object.freeze({
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    changedFiles: effectiveFiles,
    gitChanges,
    mappedGitChanges,
    changedRepositoryIds: [...new Set(gitChanges.map((x) => x.repositoryId))],
    indexRefresh,
    sourceMapping,
    before: previous,
    after,
    snapshot: after,
    semanticDiff,
    changedEntityIds,
    changedRelationIds: semanticDiff.changedRelationIds,
    directlyMappedClaimIds: mappedClaims,
    impactedClaimIds: [...impactedClaims],
    impactedTopicIds,
    affectedEntityIds,
    impact: {
      directClaimIds: directImpact.directClaimIds,
      impactedClaimIds: [...impactedClaims],
      impactedTopicIds
    },
    repositoryStatus
  });
  if (persist) saveResearchChangeIntelligence(result);
  return result;
}
