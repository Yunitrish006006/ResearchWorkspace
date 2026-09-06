# Research development guidelines

## Repository boundaries

- ResearchWorkspace coordinates graph/intelligence/viewers; Three-Factor-Digital-Twin owns manuscript, methods, experiments, results, figures and thesis-facing artifacts.
- Do not create a second manually maintained thesis copy in ResearchWorkspace.
- Cross-repository facts keep commit/path/line/hash provenance.

## Scientific boundaries

- Do not conflate synthetic full-field, real target-point, public benchmark and intervention evidence.
- Public task-aligned datasets are not dense 3-D ground truth.
- E7 pillow evidence is a held-out target-point result, not full-room real validation.
- Until E8 is complete, action recommendations remain counterfactual/model-based rankings rather than causal efficacy.

## Changes

- Identify impacted Topics/Claims before editing methods/results.
- Preserve negative results and strong baselines.
- Run the returned verification plan; a required category is not itself a passing result.
- Re-check thesis/IEEE/presentation/figure drift after research-facing changes.
- Generated source layers and viewer nodes cannot manufacture a new Claim.

## Agents

- Research Synthesizer owns integration.
- Literature Scout, Methodology Analyst and Independent Reviewer are read-only.
- Evidence Extractor writes one Topic only.
- Maximum four subagents and two parallel Evidence Extractors.
- No child-agent spawning; primary-only means zero subagents.

## Secrets and local state

- `.research-index/` is local/disposable and never committed.
- Do not expose API keys, tokens, private URLs, prompts, raw hidden reasoning or absolute local paths.
- Browser clients cannot choose Codex executable, CWD, sandbox or unsafe CLI flags.
