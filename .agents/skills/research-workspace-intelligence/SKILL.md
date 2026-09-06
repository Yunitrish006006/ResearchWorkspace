---
name: research-workspace-intelligence
description: Use for thesis research, literature/evidence analysis, methodology changes, experiment/result verification, claim traceability, artifact synchronization, or cross-repository work in ResearchWorkspace and Three-Factor-Digital-Twin. Narrow through the research graph and bounded Context Packs before broad reading; use impact, verification, and artifact-drift checks after edits.
---

# ResearchWorkspace Intelligence

Use ResearchWorkspace as the graph-first coordination layer for non-trivial thesis work.

## Retrieval order

1. Before broad repository search, call `researchWorkspace.resolve_task` when MCP is available.
2. For non-trivial work, call `researchWorkspace.orchestration_plan`. Its mode, role budget, waves, and read/write boundaries are workflow constraints.
3. Use `researchWorkspace.context_pack` for the matching audience:
   - `research-synthesizer`: integration, Claim routing, evidence boundaries.
   - `literature-scout`: read-only source/literature discovery.
   - `methodology-analyst`: read-only method, validity, and boundary review.
   - `evidence-extractor`: one bounded Topic write scope.
   - `independent-reviewer`: read-only Claim/Evidence/Verification review.
4. Search only after graph narrowing. Source results must retain repository/path/line/hash provenance.
5. Use `graph`, `claim_evidence_matrix`, and `verification_graph` when ownership or support direction is unclear.
6. Use `repository_status` and `artifact_drift` when local HEAD, dirty state, or thesis-facing synchronization can affect the answer.
7. `refresh_index` is maintenance/diagnostic. Normal change intelligence incrementally refreshes touched thesis files.

CLI fallback:

```sh
node scripts/research-intelligence.mjs resolve "<task>"
node scripts/research-intelligence.mjs orchestrate "<task>"
node scripts/research-intelligence.mjs context "<task>" research-synthesizer
node scripts/research-intelligence.mjs search "<query>"
node scripts/research-intelligence.mjs claim-evidence-matrix
node scripts/research-intelligence.mjs artifact-drift
node scripts/research-intelligence.mjs render-graph
```

## Source-of-truth rules

- `Three-Factor-Digital-Twin` owns thesis manuscript, methods, experiment code, results, figures, OpenSpec, and thesis-facing artifacts.
- ResearchWorkspace owns cross-artifact graph/intelligence, source index, orchestration, Claim Verification Graph, Change Intelligence, Replay, and viewer integration.
- `data/research-graph.json` is the audited cross-artifact semantic snapshot. Generated viewer nodes do not create new scientific claims.
- Local thesis source at its actual HEAD is authoritative for current implementation/content details. Snapshot drift is information to reconcile, not permission to overwrite newer source.
- Do not infer evidence from filenames alone when the source does not support the claim.

## Evidence boundary policy

Never merge these evidence classes:

- synthetic full-field evidence;
- real target-point evidence;
- public task-aligned benchmark evidence;
- intervention / causal evidence.

A reproducible result in one class does not silently upgrade another class. Strong baselines, adverse results, missing E8 intervention evidence, and unresolved artifact drift remain visible.

## Orchestration policy

Follow the deterministic ResearchWorkspace plan:

- `primary-only`: Research Synthesizer only; zero subagents.
- `assisted`: bounded discovery/analysis and optional independent review.
- `bounded-parallel`: only planned Evidence Extractors after discovery.
- `guarded-parallel`: Methodology Analyst stabilizes boundaries before extraction/writes.

Never exceed four subagents or two parallel Evidence Extractors. Analysis/review roles are read-only. An Evidence Extractor writes only within one assigned Topic. Children cannot spawn children. If multi-agent runtime is unavailable, execute the same waves sequentially without fabricating delegation telemetry.

## After edits

1. Run impact/change intelligence for changed thesis files.
2. Check Claim-to-Evidence coverage and impacted Topics/Claims.
3. Run the returned verification plan and record actual verification events; categories are not proof of passing.
4. Check artifact drift across thesis Markdown/TeX, IEEE manuscript, figures, presentation, and synchronization status.
5. Rebuild source/viewer data as needed. Viewer regeneration is presentation work and must not manufacture evidence.
6. Use an Independent Reviewer for substantial method, result, or Claim changes.

## Local state

`.research-index/` is disposable local state and must never be committed. It may contain source chunks, activity, verification state, change intelligence, and replay checkpoints. Generated indices preserve source provenance and are retrieval aids, not canonical thesis content.
