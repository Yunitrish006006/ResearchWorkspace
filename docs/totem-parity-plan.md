# TotemWorkspace → ResearchWorkspace parity plan

Reference baseline: `Yunitrish006006/TotemWorkspace@7145982b91bada1817ea8175f9d60076c7f1ffd2`.

The parity rule is architectural rather than lexical: ResearchWorkspace keeps the same subsystem
boundaries and behavioral contracts while replacing Minecraft/Fabric semantics with research semantics.

## Domain replacement

| TotemWorkspace | ResearchWorkspace |
|---|---|
| Module | Research Topic |
| Feature | Claim / Hypothesis |
| Component | Study / Evidence Area |
| Implementation | Paper / Evidence Artifact |
| Test | Verification / Review |
| Code Index | Source / Document Index |
| Change Intelligence | Research Change Intelligence |
| Verification Graph | Claim Verification Graph |
| Development Replay | Research Replay |

The machine-readable progress ledger is `data/totem-parity.json`.
CI fails if a declared implemented/partial capability loses all of its evidence files.

## Current migration order

1. Core intelligence + source index + orchestration + Context Pack.
2. Shared graph view model + legacy 3D + Flutter production root.
3. Change/verification/activity overlays in both viewers.
4. Research Replay timeline and historical graph reconstruction.
5. Real Codex task execution and JSONL-to-graph activity mapping.
6. Repository status/drift, incremental index refresh, and artifact synchronization.
7. Remote SSH/tmux bridge, conversation sync, and CodexDiscord parity.
8. Full Flutter ↔ legacy behavior regression suite.

A capability marked `partial` is not considered Totem-parity complete.

## Tool-first freeze

The full tool layer is now a separately audited surface. See `data/tool-surface.json` and `docs/tooling.md`.
The tool workflow fails on missing CLI commands, MCP tools, Local Bridge routes, Remote Bridge actions, CodexDiscord files/tests, or Totem `tools/` reference drift.
