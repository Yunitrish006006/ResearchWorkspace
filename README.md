# ResearchWorkspace

ResearchWorkspace is the research-intelligence coordination layer for
`Yunitrish006006/Three-Factor-Digital-Twin`. Its system architecture is a
research-domain port of the production contracts in
`Yunitrish006006/TotemWorkspace`, not a visual-only fork.

Reference baseline: `TotemWorkspace@74822eb2de6a6bdf31c595b4f148a536a023b105`.

## Production surfaces

- **GitHub Pages / Flutter Wasm:** https://yunitrish006006.github.io/ResearchWorkspace/
- **Legacy JavaScript 3D viewer:** https://yunitrish006006.github.io/ResearchWorkspace/legacy/
- **Research overview:** https://yunitrish006006.github.io/ResearchWorkspace/overview.html
- **Local Bridge:** `http://127.0.0.1:18775/`

GitHub Pages builds from the latest canonical thesis checkout, rebuilds the source/document
index and the shared graph model, then publishes Flutter as the production root while retaining
the JavaScript viewer as a rollback/debug surface.

## Domain mapping

| TotemWorkspace | ResearchWorkspace |
|---|---|
| Module | Research Topic |
| Feature | Claim / Hypothesis |
| Component | Study / Evidence Area |
| Implementation | Paper / Evidence Artifact |
| Test | Verification / Review |
| Code Index / Inventory | Source / Document Index / Inventory |
| Change Intelligence | Research Change Intelligence |
| Verification Graph | Claim Verification Graph |
| Development Replay | Research Replay |
| Explorer | Literature Scout |
| Architect | Methodology Analyst |
| Worker | Evidence Extractor |
| Reviewer | Independent Reviewer |
| Primary | Research Synthesizer |

Minecraft/Fabric/Gradle semantics are not research truth. Their subsystem positions and safety
contracts are ported; their domain meaning is replaced.

## Implemented architecture

- stable typed Research Knowledge Graph;
- source/document index with repository/path/line/SHA-256 provenance;
- incremental changed-file refresh;
- high-confidence source → Claim/Evidence/Topic mapping;
- deterministic adaptive orchestration:
  - `primary-only`
  - `assisted`
  - `bounded-parallel`
  - `guarded-parallel`
- maximum four subagents and two parallel Evidence Extractors;
- audience-specific Context Packs;
- Claim-to-Evidence Matrix;
- Claim Verification Graph and live verification telemetry;
- Research Change Intelligence;
- Git-based thesis artifact drift detection;
- durable Research Replay with sessions/checkpoints/historical entity sets;
- Research Agent Activity;
- opt-in real Codex Agent Adapter;
- Viewer ↔ Discord Conversation Sync;
- Research CodexDiscord;
- loopback Local Bridge;
- Remote-SSH/tmux/nohup controller;
- MCP + CLI;
- Flutter 3D production viewer and Legacy 3D viewer;
- Progressive Semantic LOD;
- GitHub Pages, Node, Flutter, source-inventory, and CodexDiscord CI;
- machine-readable Totem parity ledger.

The parity ledger is `data/totem-parity.json`.

## Canonical thesis ownership

`Three-Factor-Digital-Twin` remains authoritative for:

- thesis/manuscript source;
- methods and OpenSpec;
- experiment implementation;
- datasets and simulation;
- figures and generated outputs;
- results and thesis-facing presentation artifacts.

ResearchWorkspace indexes and relates those artifacts; it does not create a second manually
maintained copy of the thesis.

## Quick start

The thesis checkout may be a sibling named `Three-Factor-Digital-Twin` or
`school`. `RESEARCH_THESIS_REPO` explicitly overrides automatic discovery.
The active enclosure research and E15 record live in the canonical thesis
checkout; see its `openspec/changes/confirm-bmc-temporal-transfer-e15/evidence.md`.

```bash
node scripts/validate-all.mjs
node scripts/research-intelligence.mjs summary
node scripts/research-intelligence.mjs repository-status
node scripts/research-intelligence.mjs claim-evidence-matrix
node scripts/research-intelligence.mjs artifact-drift
node scripts/research-intelligence.mjs build-index
node scripts/report-source-inventory.mjs
node scripts/serve-local-viewer.mjs
```

For Remote-SSH:

```bash
bash tools/remote/bridge.sh doctor
bash tools/remote/bridge.sh start
bash tools/remote/bridge.sh status
```

## Real Codex adapter

Disabled by default:

```bash
export RESEARCH_AGENT_ADAPTER=codex
export RESEARCH_CODEX_CWD=/path/to/ResearchWorkspace
export RESEARCH_CODEX_SANDBOX=workspace-write
node scripts/serve-local-viewer.mjs
```

The host chooses executable, CWD, sandbox and model. Browser requests cannot override them.
The adapter never adds `--full-auto` or dangerous sandbox/approval bypass flags.

After a task ends, the Bridge refreshes the source index, updates Change Intelligence, regenerates
graph data, and records a Replay checkpoint.

## MCP tools

- `resolve_task`
- `orchestration_plan`
- `graph`
- `search`
- `context_pack`
- `impact`
- `verification_plan`
- `test_plan`
- `verification_graph`
- `verification_state`
- `change_intelligence`
- `replay`
- `repository_status`
- `claim_evidence_matrix`
- `artifact_drift`
- `refresh_index`
- `summary`

## Evidence boundary

Synthetic full-field evidence, real target-point evidence, public task-aligned benchmark evidence,
and intervention/causal evidence are separate evidence classes. One class cannot silently upgrade
another. Negative results, strong baselines, and missing intervention evidence remain visible.

## Local state

`.research-index/` is disposable and ignored by Git. It may contain source chunks, Change
Intelligence, verification state, activity and Replay checkpoints. Generated retrieval/viewer data
does not become canonical scientific evidence.
