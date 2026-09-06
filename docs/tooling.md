# ResearchWorkspace tool suite

The tool layer is treated as a first-class TotemWorkspace parity surface. A tool is not considered complete
just because a file exists: its commands/routes, safety boundaries, package tests, and cross-tool contracts must
also pass CI.

Audited Totem baseline: `Yunitrish006006/TotemWorkspace@7145982b91bada1817ea8175f9d60076c7f1ffd2`.

## Tool groups

| Group | Entry point | Contract |
|---|---|---|
| Research Intelligence CLI | `scripts/research-intelligence.mjs` | graph/search/context/impact/verification/replay/status/drift/tool status |
| Research Activity CLI | `scripts/research-activity.mjs` | activity, verification telemetry, prompt switch, replay |
| MCP | `mcp/server.mjs` | same research-intelligence operations as structured MCP tools |
| Local Bridge | `scripts/serve-local-viewer.mjs` | loopback HTTP API, prompt dispatch, conversation relay, viewer state |
| Remote Bridge | `tools/remote/bridge.sh` | tmux/nohup lifecycle, active-task guard, Flutter build/bootstrap |
| Flutter bootstrap | `tools/remote/bootstrap-flutter.sh` | pinned user-space Flutter install/status |
| CodexDiscord | `tools/codex-discord/` | allowlisted Discord/Codex App Server and conversation sync |
| Agent skill | `.agents/skills/research-workspace-intelligence/` | graph-first research operating instructions |
| Source inventory | `scripts/report-source-inventory.mjs` | source-first inventory and mapping coverage |

## Status

```sh
node scripts/research-intelligence.mjs tool-status
node scripts/validate-tool-surface.mjs
```

A full external Totem tool-surface audit is:

```sh
git clone --depth=1 https://github.com/Yunitrish006006/TotemWorkspace.git ../TotemWorkspace
node scripts/validate-tool-surface.mjs --reference-root ../TotemWorkspace
```

The dedicated `Validate Research Tool Suite` workflow additionally runs the CodexDiscord package tests,
Agent Adapter runtime fixture, MCP/Local Bridge/Remote Bridge validators, and shell syntax checks.

## Security invariants

The Local/Remote Bridge remains bound to `127.0.0.1`. Discord workspace sync is bearer-authenticated and
loopback-only. Codex uses `workspace-write` or `read-only`; ResearchWorkspace does not inject
`--full-auto` or dangerous sandbox-bypass flags. Absolute local paths are not emitted in public activity.
