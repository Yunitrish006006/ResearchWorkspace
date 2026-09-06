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
