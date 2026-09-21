# ResearchWorkspace current status

Status date: 2026-09-06

## Current thesis handoff (2026-09-21)

- Current canonical thesis HEAD: `add7118c5ba8f98946f80bb8fc2d15e380e7b2f2`
- Research route artifacts remain owned by the thesis checkout:
  - `docs/research/api_candidate_comparison_2026-09-21_zh.md`
  - `docs/research/systematic_parameter_tuning_protocol_2026-09-21_zh.md`
  - `openspec/changes/systematic-parameter-tuning-20260921/`
  - `docs/reports/professor_catchup_report_2026-09-21_zh.html`
- Current evidence status: API comparison and protocol are complete; TCLab simulation smoke test passes with repeatable hashes; Linux BOPTEST locked validation/holdout passes for one FMU on two new dates against fixed PI; the gate decision keeps E8 intervention `NOT_EVALUATED` pending more testcases/seeds; toy, simulation, and BOPTEST artifacts remain non-causal evidence.
- The audited graph snapshot below remains historical by design; generated views should expose the current thesis HEAD and snapshot drift rather than silently rewriting audit provenance.

## Audited upstream baselines

- TotemWorkspace reference implementation:
  `74822eb2de6a6bdf31c595b4f148a536a023b105`
- Audited thesis snapshot in the research graph:
  `ea1d9194c8252e81cae2fe6842fa4064bab97397`
- Canonical thesis repository:
  `Yunitrish006006/Three-Factor-Digital-Twin`

The generated graph view model also reads the current local thesis HEAD when a thesis checkout is
present. It exposes both current and audited commit values so snapshot drift is explicit.

## Runtime architecture

```text
Three-Factor-Digital-Twin
        │
        ├── source/document index
        ├── source → Claim/Evidence mapping
        ├── repository + artifact drift
        │
        ▼
ResearchWorkspace semantic kernel
        │
        ├── orchestration / Context Packs
        ├── Claim Verification Graph
        ├── Change Intelligence
        ├── Agent Activity
        ├── Research Replay
        └── Claim-to-Evidence Matrix
        │
        ├──────── MCP / CLI
        ├──────── Local Bridge / Codex
        ├──────── CodexDiscord
        │
        ├──────── Flutter production 3D viewer
        └──────── Legacy JavaScript 3D viewer
```

## Parity policy

`data/totem-parity.json` is the machine-readable Definition of Done. Capabilities marked
implemented must retain evidence files and validators. Domain-specific Minecraft/Fabric semantics
are replaced rather than copied into the research graph.

## Research evidence boundary

Current graph deliberately keeps the E8 causal/intervention Claim unsupported until real before/after
evidence exists. Public benchmark results do not become dense 3-D ground truth, and E7 real pillow
target-point evidence does not become full-room real ground truth.
