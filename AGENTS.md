# ResearchWorkspace agent instructions

ResearchWorkspace is the research-intelligence coordination layer for the thesis repository
`Yunitrish006006/Three-Factor-Digital-Twin`.

## Source of truth

- The thesis repository owns thesis text, experiments, OpenSpec, datasets references, figures,
  generated outputs, and method implementation.
- ResearchWorkspace owns the cross-artifact research graph, source index, orchestration,
  change intelligence, verification graph, replay, viewer, and integration contracts.
- Do not copy generated thesis artifacts here as a second source of truth.

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
- Local Bridge must remain loopback-only.
- Prompt execution is opt-in and must not imply an agent ran when the adapter is unavailable.
- Generated viewer data must not become a second manually curated research graph.
