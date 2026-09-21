# ResearchWorkspace agent instructions

ResearchWorkspace is the research-intelligence coordination layer for the thesis repository
`Yunitrish006006/Three-Factor-Digital-Twin`.

## Source of truth

- The thesis repository owns thesis text, experiments, OpenSpec, datasets references, figures,
  generated outputs, and method implementation.
- ResearchWorkspace owns the cross-artifact research graph, source index, orchestration,
  change intelligence, verification graph, replay, viewer, and integration contracts.
- Do not copy generated thesis artifacts here as a second source of truth.

## Durable project memory

- User-confirmed project preferences and reusable workflows live in
  `data/project-memory/`; start with its `README.md` and read the matching entry.
- Before preparing or revising a professor report, weekly/catch-up report, oral
  script, or research-report HTML (教授報告、週報、補報、講稿), read
  `data/project-memory/professor-report-workflow_zh.md` in full. Apply its
  first-person narrative, research-process coverage, source checks, and HTML QA.
- Store durable workflow memory here, not in disposable `.research-index/`
  state. Keep actual reports and scientific evidence in the thesis repository.
- These files are workflow instructions, not automatically injected Context Pack
  content or evidence of scientific results. Read them explicitly; verify current
  research status against canonical sources. New explicit user instructions take
  precedence over recorded preferences.

## TotemWorkspace parity rule

`Yunitrish006006/TotemWorkspace` is the reference implementation for workspace behavior.
Port architecture and behavioral contracts, but replace Minecraft/Fabric semantics with research semantics.

Domain mapping:

- Module -> Research Topic
- Feature -> Claim / Hypothesis
- Component -> Study / Evidence Area
- Implementation -> Paper / Evidence Artifact
- Test -> Verification / Review
- Change Intelligence -> Research Change Intelligence
- Verification Graph -> Claim Verification Graph
- Development Replay -> Research Replay

Agent role mapping:

- Explorer -> Literature Scout
- Architect -> Methodology Analyst
- Worker -> Evidence Extractor
- Reviewer -> Independent Reviewer
- Primary -> Research Synthesizer

## Non-negotiable boundaries

- Preserve stable IDs and typed relations.
- Keep synthetic full-field, real target-point, public task-aligned, and intervention evidence separate.
- Negative and missing evidence must stay visible.
- Evidence Extractor write scope is one assigned research topic.
- Literature Scout, Methodology Analyst, and Independent Reviewer are read-only.
- Adaptive orchestration allows at most 4 subagents and at most 2 parallel Evidence Extractors.
- Use the model and reasoning effort returned by the orchestration plan for each
  planned role; see `docs/model-tiering.md`. Explicit user model choices take
  precedence. Report unavailable model/runtime support and never describe a
  planned assignment as an observed agent execution.
- Local Bridge must remain loopback-only.
- Prompt execution is opt-in and must not imply an agent ran when the adapter is unavailable.
- Generated viewer data must not become a second manually curated research graph.
