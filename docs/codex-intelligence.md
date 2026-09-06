# ResearchWorkspace intelligence and Codex

## Retrieval

Use the ResearchWorkspace MCP or CLI to narrow non-trivial tasks before broad reading.

```bash
node scripts/research-intelligence.mjs resolve "<task>"
node scripts/research-intelligence.mjs orchestrate "<task>"
node scripts/research-intelligence.mjs context "<task>" research-synthesizer
node scripts/research-intelligence.mjs search "<query>"
```

The source index preserves repository, path, line range, and SHA-256. Changed thesis text files are
incrementally re-chunked. Registered provenance has priority; otherwise only high-confidence lexical
mapping is promoted into Change Intelligence.

## Adaptive orchestration

Thresholds are retained from the Totem reference:

- score 0–2: `primary-only`;
- score 3–5: `assisted`;
- score 6–9: `bounded-parallel`;
- score 10+: `guarded-parallel`.

Maximum subagents: 4. Maximum parallel Evidence Extractors: 2. Literature Scout, Methodology Analyst
and Independent Reviewer are read-only. Evidence Extractor has a one-Topic write scope.

## Codex Adapter

`RESEARCH_AGENT_ADAPTER=codex` enables the host-side adapter. It probes `codex --version`, enforces
the allowed CWD roots and sandbox, dispatches `codex exec --json`, maps JSONL events to Research
Agent Activity, and performs post-task refresh/checkpoint work.

The browser cannot select executable, CWD, sandbox, model or arbitrary CLI flags.

## Conversation Sync

Viewer and Research CodexDiscord can share one Bridge queue. The private transport uses
`RESEARCH_CONVERSATION_SYNC_TOKEN`. Full prompt bodies remain ephemeral and are not written to
Research Replay.

## Verification and Replay

Actual `verification_started/passed/failed` events fold into the latest Verification state and
are visible in both viewers. Replay stores bounded sessions, events, milestones and graph/checkpoint
state under `.research-index/`.
