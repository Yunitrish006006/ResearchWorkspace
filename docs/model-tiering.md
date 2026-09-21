# Model tiering

ResearchWorkspace assigns models and reasoning effort by role, task complexity,
and research risk. The shared policy is `data/model-tiering.json`; selection lives
in `intelligence/model-tiering.mjs`.

| Tier | Default model | Effort | Use |
| --- | --- | --- | --- |
| efficient | `gpt-5.6-luna` | medium | Literature Scout; small, unambiguous primary tasks |
| balanced | `gpt-5.6-terra` | medium | Evidence Extractor; ordinary primary work |
| deep | `gpt-6-astra` | high | Methodology Analyst, Independent Reviewer, complex primary work |

These are project routing defaults, not price or quality guarantees. All three
models and the configured effort levels were present in the local authenticated
Codex model catalog on 2026-09-21. Account availability can change.

## Selection and execution

- Primary: scores 0–2 use efficient when routing is certain; scores 3–9 use
  balanced; scores above 9 use deep. Uncertain low-score tasks use balanced.
- Causal/intervention/control, methodology, leakage, statistics, or validity
  queries promote the primary and Evidence Extractor to deep regardless of score.
  Read-only literature discovery remains efficient.
- Guarded plans reserve a slot for independent review: analyst + scout + one
  extractor + reviewer. The four-subagent/two-parallel-extractor caps still apply.
- CLI `orchestrate`, MCP `orchestration_plan`, and the Bridge plan endpoint return
  `primary` plus per-assignment `tier`, `model`, `reasoningEffort`, `source`, and
  `reason`. Context Packs expose the audience's `modelSelection` too.
- The opt-in Local Bridge adapter passes the selected primary to `codex exec
  --model` and `-c model_reasoning_effort=...`. Its task/status payload contains the
  effective `modelSelection`. Browser payloads cannot override these settings.
- Discord keeps `/codex model` and `/codex reasoning` authoritative for the
  primary, including the local-default choice. New and resumed App Server
  threads receive the same per-role tier plan in developer instructions.
- Spawned-role selection is passed as instructions to the primary: use explicit
  model/effort arguments on supported runtimes. It is not an independent worker
  launcher and cannot force a currently running interactive Codex session to
  switch models. Custom Codex agent files can take precedence over spawn values.
- If multi-agent tools or a planned model are unavailable, disclose the limitation
  and perform appropriate work sequentially in the primary. Do not claim that a
  planned agent actually ran or silently downgrade a required review model.

## Host configuration

Tiering defaults to `auto`. Set `RESEARCH_MODEL_TIERING=off` to inherit local model
defaults while retaining the orchestration roles and evidence boundaries.

The host may set `RESEARCH_MODEL_EFFICIENT`, `RESEARCH_MODEL_BALANCED`, and
`RESEARCH_MODEL_DEEP`. Each accepts a corresponding `_EFFORT` variable. When a
model is overridden without an effort, the previous tier's effort is omitted;
Codex resolves its local configuration/model default.

For the Local Bridge primary, `RESEARCH_CODEX_MODEL` and
`RESEARCH_CODEX_REASONING_EFFORT` take precedence over automatic selection. An
explicit model without an explicit effort leaves effort to Codex's local
configuration/model default. Override
values are validated before dispatch; invalid settings fail without spawning.
No automatic retry is made after a model failure, since a task may have already
changed files.

```bash
node scripts/research-intelligence.mjs orchestrate "causal intervention methodology review"
node scripts/research-intelligence.mjs context "public benchmark evidence" reviewer
node scripts/validate-model-tiering.mjs
node scripts/validate-all.mjs
```

Model selection does not enable prompt execution. Keep the existing opt-in
`RESEARCH_AGENT_ADAPTER=codex` and viewer prompt settings to execute Bridge tasks.
Restart the Bridge or Discord process after changing its environment.

## Verification and references

The tier validator covers thresholds, English/Chinese research risk, host/manual
overrides, off mode, invalid values, review retention, Context Packs, and actual
arguments sent to a fake Codex process. Discord tests verify new/resumed thread
instructions and preservation of explicit primary choices. These checks do not
consume model inference or prove live child-agent execution.

The parameter and inheritance behavior follows the official OpenAI documentation:
[Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) and
[Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
