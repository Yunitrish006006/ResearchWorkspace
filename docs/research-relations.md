# Research relation contracts

ResearchWorkspace keeps research relationship categories separate because their epistemic meaning differs.

## Curated relation types

- `contains`: semantic hierarchy only. It does not imply scientific support.
- `supports`: evidence/traceability support. A support edge is bounded by the source evidence class.
- `uses-method`: the source Claim depends on or consumes a named method/estimator concept.
- `grounded-in`: the source interpretation is bounded by a prerequisite scientific or governance Claim.
- `validated-by`: Verification/Review is connected to a Claim; runtime pass/fail state is tracked separately.
- `limits`: adverse evidence, a strong baseline, missing evidence, or a boundary that constrains the stronger Claim.

The six manually curated cross-Claim relations are audited in `data/relationship-audit.json`.
Generated hierarchy edges for Source Areas/Artifacts and generated Verification edges are not manually reclassified as scientific support.

## Direction matters

Examples:
- Hybrid residual **grounded-in** interpretable primary estimator.
- Persistence result **limits** public-benchmark superiority.
- Missing real intervention evidence **limits** a causal-efficacy interpretation.
- Traceability **supports** artifact synchronization.

A visualization convenience must not reverse these directions.

## Evidence classes

Relationship rendering never merges:
- synthetic full-field evidence;
- real target-point evidence;
- public task-aligned benchmark evidence;
- intervention/causal evidence.

A relation can connect Claims across these areas only when its label explicitly expresses a boundary or limitation.

## Paper-first 3D view

The default viewer now derives `paperGraph` from the canonical Chinese thesis, its bibliography,
local experiment JSON, and the result-verification report. `intelligence/paper-graph.mjs` owns
this projection; do not manually edit generated graph assets. The original governance graph
and stable research IDs remain available through the view switch.

- Layer 1: main paper and cited papers. Dataset/document references retain their own types.
- Deeper layers: thesis sections and citation points, methods/datasets/experiments, comparison
  cases, and individual metric results. Expansion preserves parent containment.
- `cites`: citing thesis paragraph (path, line, section) to the referenced concept.
- `argues`: source interpretation or bounded experiment evidence to a thesis point. It is
  not an automatic claim of scientific proof.
- `compares`: contextual comparisons. Lower MAE/RMSE/P95 gives BETTER, WORSE or TIE;
  cross-paper method discussion without matched data is NOT_COMPARABLE.
- `uses-data` and `uses-method`: experiment inputs and algorithms.

Collapsed relationships project to the nearest visible ancestor without reversing direction.
The detail panel preserves underlying endpoints and can reveal both endpoints. Green means
better, pink worse, yellow tie, and gray not directly comparable; numerical comparisons keep
metric, units, target, horizon/run and source locations. A gain on one metric never erases a
loss on another metric or an adverse run.

External source locations not present in the local research records are explicitly marked
`SOURCE_LOCATION_PENDING`. A citing paragraph is not evidence of the original paper's page,
section or exact wording. These pending points need a separate source-reading pass; this
projection does not invent anchors. Missing result files produce visible warnings.

Validation: `node scripts/validate-paper-graph.mjs`, Flutter graph tests, and the existing
viewer/parity validators. Regenerate both assets with the render scripts before building Flutter.
