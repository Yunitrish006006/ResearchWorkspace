# ResearchWorkspace — reference-driven bootstrap

ResearchWorkspace is a research-domain generalization of the proven architectural patterns in `Yunitrish006006/TotemWorkspace`.

This bootstrap was designed after auditing TotemWorkspace `main` at commit `bc333be5ced66b6310b1b2acb56ba91b93145577` rather than treating TotemWorkspace as visual inspiration only.

## What is implemented now

- stable research entity IDs
- typed research graph relations
- graph-first task resolution
- audience-specific Context Packs
- opt-in Codex Agent Adapter with the same orchestration envelope
- source/document lexical index with provenance excerpts
- adaptive orchestration with the same four mode thresholds
- bounded research roles
- Claim Verification Graph bootstrap
- live verification state folding
- research activity stream
- durable Research Replay and checkpoints
- Research Change Intelligence semantic snapshot/diff core
- loopback-only Local Bridge
- stdio MCP server
- legacy browser viewer consuming the shared graph/API
- Flutter shared graph/live-state contract skeleton
- regression validators and GitHub Actions workflow

## Intentionally not copied

- Minecraft/Fabric module relationships
- Gradle/GameTest semantics
- Java/Kotlin source-code inventory heuristics
- TotemCore shared API ownership rules
- source-code implementation nodes as research truth

## Quick start

```sh
node scripts/validate-all.mjs
node scripts/research-intelligence.mjs summary
node scripts/research-intelligence.mjs resolve "behavioral contracts evidence"
node scripts/research-intelligence.mjs orchestrate "review contradictory evidence across two studies"
node scripts/research-intelligence.mjs build-index
node scripts/serve-local-viewer.mjs
```

Then open `http://127.0.0.1:18775/`.

## MCP

```sh
node mcp/server.mjs
```

Tools:

- `resolve_task`
- `orchestration_plan`
- `graph`
- `search`
- `context_pack`
- `impact`
- `verification_plan`
- `test_plan` (compatibility alias)
- `refresh_index`
- `summary`

## Important boundary

The bootstrap includes an **opt-in Codex Agent Adapter**. It is disabled by default. `/api/prompt` always records the prompt and deterministic orchestration plan; it dispatches Codex only when `RESEARCH_AGENT_ADAPTER=codex` passes the host-side availability/sandbox/CWD checks. When no adapter is available, the API returns `agent-adapter-unavailable` and never claims execution started. Browser payloads cannot select the executable, CWD, sandbox, or model.

See `docs/reference-architecture-audit.md` and `docs/architecture.md`.

### Optional Codex adapter

```bash
export RESEARCH_AGENT_ADAPTER=codex
export RESEARCH_CODEX_SANDBOX=workspace-write   # or read-only
# Optional, host-controlled only:
# export RESEARCH_CODEX_BIN=codex
# export RESEARCH_CODEX_CWD=/path/to/ResearchWorkspace
# export RESEARCH_CODEX_MODEL=<model>
node scripts/serve-local-viewer.mjs
```

The adapter preserves the TotemWorkspace safety contract: workspace-bounded CWD, explicit sandbox allow-list, one active task at a time, JSONL activity mapping, repository-relative browser-visible paths, the same orchestration envelope used by MCP/Bridge, and no forced `--full-auto` or approval-bypass flags.
