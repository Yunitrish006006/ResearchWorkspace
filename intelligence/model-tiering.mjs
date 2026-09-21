import fs from "node:fs";

const defaults = JSON.parse(fs.readFileSync(new URL("../data/model-tiering.json", import.meta.url), "utf8"));
const MODEL = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);
const TIERS = ["efficient", "balanced", "deep"];

export function modelName(value) {
  if (value == null || value === "" || value === "default") return null;
  if (typeof value !== "string" || !MODEL.test(value.trim())) throw new Error("Invalid model name");
  return value.trim();
}

export function reasoningEffort(value) {
  if (value == null || value === "" || value === "default") return null;
  if (typeof value !== "string" || !EFFORTS.has(value.trim())) throw new Error("Invalid reasoning effort");
  return value.trim();
}

export function modelTieringConfiguration(env = process.env) {
  const mode = String(env.RESEARCH_MODEL_TIERING ?? "auto").toLowerCase();
  if (!["auto", "off"].includes(mode)) throw new Error("RESEARCH_MODEL_TIERING must be auto or off");
  const tiers = Object.fromEntries(TIERS.map((tier) => {
    const prefix = `RESEARCH_MODEL_${tier.toUpperCase()}`;
    const model = modelName(env[prefix] ?? defaults.tiers[tier].model);
    if (!model) throw new Error(`${prefix} must name a model`);
    // A new model may not support the default tier's effort. Leave effort to
    // Codex's local configuration/model default unless the host supplies it.
    const effort = env[`${prefix}_EFFORT`] ?? (env[prefix] ? null : defaults.tiers[tier].reasoningEffort);
    return [tier, Object.freeze({ model, reasoningEffort: reasoningEffort(effort) })];
  }));
  return Object.freeze({ schemaVersion: defaults.schemaVersion, mode, tiers: Object.freeze(tiers), roles: Object.freeze({ ...defaults.roles }) });
}

export function researchRisk(query = "") {
  return /\b(causal|control|intervention|methodology|leakage|statistical|validity)\b|因果|控制|介入|方法學|資料洩漏|統計|有效性/iu.test(query);
}

export function selectRoleModel({ role = "research-synthesizer", score = 0, highRisk = false, routingUncertainty = false, config = modelTieringConfiguration() } = {}) {
  let tier = config.roles[role];
  if (!tier) throw new Error(`Unknown model-tiering role: ${role}`);
  let reason = `role:${role}`;
  if (role === "research-synthesizer") {
    tier = highRisk || score > 9 ? "deep" : score <= 2 && !routingUncertainty ? "efficient" : "balanced";
    reason = highRisk ? "research-risk" : score > 9 ? "cross-artifact-complexity" : routingUncertainty ? "uncertain-routing" : "task-complexity";
  } else if (role === "evidence-extractor" && highRisk) {
    tier = "deep";
    reason = "research-risk";
  }
  return Object.freeze({
    tier: config.mode === "off" ? null : tier,
    model: config.mode === "off" ? null : config.tiers[tier].model,
    reasoningEffort: config.mode === "off" ? null : config.tiers[tier].reasoningEffort,
    source: config.mode === "off" ? "local-default" : "tier-policy",
    reason
  });
}

export function applyModelTiering(plan, { config = modelTieringConfiguration(), model = null, effort = null, preserveDefault = false } = {}) {
  const inputs = { score: plan.score, highRisk: researchRisk(plan.query), routingUncertainty: plan.routingUncertainty === true, config };
  const requestedModel = modelName(model);
  const requestedEffort = reasoningEffort(effort);
  let primary = selectRoleModel({ ...inputs, role: "research-synthesizer" });
  if (requestedModel || preserveDefault) {
    primary = Object.freeze({ tier: null, model: requestedModel, reasoningEffort: requestedEffort, source: requestedModel ? "explicit-model" : "local-default", reason: "host-or-user-selection" });
  } else if (requestedEffort) {
    primary = Object.freeze({ ...primary, reasoningEffort: requestedEffort, source: "explicit-effort" });
  }
  return Object.freeze({
    ...plan,
    modelTiering: Object.freeze({ schemaVersion: config.schemaVersion, mode: config.mode }),
    primary,
    assignments: (plan.assignments ?? []).map((assignment) => Object.freeze({ ...assignment, ...selectRoleModel({ ...inputs, role: assignment.role }) }))
  });
}

export function modelTieringInstructions(plan) {
  if (!plan?.modelTiering) return [];
  const lines = [
    `Model tiering: ${plan.modelTiering.mode}; primary=${plan.primary.model ?? "local-default"}; effort=${plan.primary.reasoningEffort ?? "model-default"}.`,
    `Orchestration mode: ${plan.mode}; maximum planned subagents: ${plan.assignments.length}.`
  ];
  for (const assignment of plan.assignments) {
    lines.push(`Role ${assignment.role}: model=${assignment.model ?? "inherit"}; reasoning_effort=${assignment.reasoningEffort ?? "model-default"}; access=${assignment.access}; scope=${assignment.scope.join(",")}; wave=${assignment.wave}.`);
  }
  lines.push(
    "When spawning a planned role, pass its explicit model and reasoning_effort if supported by the runtime. Use a fresh context if changing models requires it.",
    "Do not replace an unavailable model with a weaker tier silently. Report the limitation and execute that role sequentially in the primary when appropriate.",
    "Planned model assignments are not proof of agent execution; report only observed runtime activity."
  );
  return lines;
}
