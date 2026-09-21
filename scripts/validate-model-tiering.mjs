import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyModelTiering, modelTieringConfiguration, researchRisk, selectRoleModel } from "../intelligence/model-tiering.mjs";
import { buildOrchestrationPlan } from "../intelligence/orchestration-plan.mjs";
import { buildContextPack } from "../intelligence/context-pack.mjs";
import { adapterConfiguration, buildCodexArgs, createAgentAdapter } from "../intelligence/agent-adapter.mjs";

const config = modelTieringConfiguration({});
assert.equal(selectRoleModel({ score:2, config }).tier, "efficient");
assert.equal(selectRoleModel({ score:3, config }).tier, "balanced");
assert.equal(selectRoleModel({ score:9, config }).tier, "balanced");
assert.equal(selectRoleModel({ score:10, config }).tier, "deep");
assert.equal(selectRoleModel({ score:0, highRisk:true, config }).tier, "deep");
assert.equal(selectRoleModel({ score:0, routingUncertainty:true, config }).tier, "balanced");
for (const [role, tier] of Object.entries(config.roles)) {
  assert.equal(selectRoleModel({ role, score:5, config }).tier, tier);
}
assert.equal(selectRoleModel({ role:"evidence-extractor", highRisk:true, config }).tier, "deep");
assert.equal(selectRoleModel({ role:"literature-scout", highRisk:true, config }).tier, "efficient");
for (const query of ["causal intervention", "檢查資料洩漏與統計有效性", "methodology review"]) assert.ok(researchRisk(query));
assert.equal(researchRisk("controller.js typography"), false);
assert.throws(() => selectRoleModel({ role:"unknown", config }), /Unknown/);
assert.throws(() => modelTieringConfiguration({ RESEARCH_MODEL_TIERING:"oops" }), /auto or off/);
assert.throws(() => modelTieringConfiguration({ RESEARCH_MODEL_DEEP:"bad --model" }), /model name/);
assert.throws(() => modelTieringConfiguration({ RESEARCH_MODEL_DEEP_EFFORT:"impossible" }), /reasoning effort/);
assert.throws(() => modelTieringConfiguration({ RESEARCH_MODEL_DEEP:"default" }), /must name a model/);
const customized = modelTieringConfiguration({ RESEARCH_MODEL_BALANCED:"host-model" });
assert.equal(customized.tiers.balanced.model, "host-model");
assert.equal(customized.tiers.balanced.reasoningEffort, null);

const guarded = buildOrchestrationPlan({ query:"causal intervention methodology public benchmark evidence", changedTopics:["public","action","governance"], modelConfig:config });
assert.equal(guarded.mode, "guarded-parallel");
assert.equal(guarded.primary.model, "gpt-6-astra");
assert.equal(guarded.assignments.length, 4);
assert.equal(guarded.assignments.at(-1).role, "independent-reviewer");
assert.ok(guarded.assignments.some((x) => x.role === "methodology-analyst"));
assert.ok(guarded.assignments.some((x) => x.role === "evidence-extractor"));
assert.deepEqual(guarded.waves, ["discovery","extraction","review"]);
assert.deepEqual(buildOrchestrationPlan({ query:guarded.query, changedTopics:["public","action","governance"], modelConfig:config }), guarded);

const primaryOnly = applyModelTiering({ query:"lookup", score:1, mode:"primary-only", assignments:[] }, { config });
assert.equal(primaryOnly.primary.model, "gpt-5.6-luna");
assert.equal(primaryOnly.assignments.length, 0);
const explicit = applyModelTiering(guarded, { config, model:"host-model" });
assert.equal(explicit.primary.source, "explicit-model");
assert.equal(explicit.primary.model, "host-model");
assert.equal(explicit.primary.reasoningEffort, null);
assert.equal(applyModelTiering(guarded, { config, model:"host-model", effort:"low" }).primary.reasoningEffort, "low");
assert.equal(applyModelTiering(guarded, { config, preserveDefault:true }).primary.model, null);
const off = modelTieringConfiguration({ RESEARCH_MODEL_TIERING:"off" });
const disabled = applyModelTiering(guarded, { config:off });
assert.equal(disabled.primary.model, null);
assert.ok(disabled.assignments.every((x) => x.model === null && x.reasoningEffort === null));
assert.equal(applyModelTiering(guarded, { config:off, model:"manual" }).primary.model, "manual");

const context = buildContextPack(guarded.query, { audience:"reviewer", includeSources:false, modelConfig:config });
assert.equal(context.modelSelection.model, "gpt-6-astra");
assert.equal(context.modelSelection.tier, "deep");
assert.equal(context.constraints.readOnly, true);
assert.ok(context.orchestration.assignments.some((x) => x.role === "independent-reviewer"));

const adapterConfig = adapterConfiguration({ RESEARCH_AGENT_ADAPTER:"codex" });
const execution = buildCodexArgs({ prompt:guarded.query, config:adapterConfig, orchestrationPlan:guarded });
assert.equal(execution.args[execution.args.indexOf("--model") + 1], "gpt-6-astra");
assert.ok(execution.args.includes('model_reasoning_effort="high"'));
assert.match(execution.stdin, /literature-scout: model=gpt-5.6-luna/);
assert.match(execution.stdin, /independent-reviewer: model=gpt-6-astra/);
assert.match(execution.stdin, /not proof of agent execution/);
const unconfigured = buildCodexArgs({ prompt:"lookup", config:{ ...adapterConfig, modelTiering:off }, orchestrationPlan:guarded });
assert.ok(!unconfigured.args.includes("--model"));
assert.ok(!unconfigured.args.includes("-c"));

const child = new EventEmitter();
child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
child.kill = () => true;
let spawned;
const adapter = createAgentAdapter({
  env:{ RESEARCH_AGENT_ADAPTER:"codex", RESEARCH_MODEL_DEEP:"host-deep", RESEARCH_MODEL_DEEP_EFFORT:"high" },
  spawnSyncImpl:() => ({ status:0, stdout:"codex fixture" }),
  spawnImpl:(command,args) => { spawned = { command,args }; return child; }
});
const task = adapter.dispatch({ prompt:"causal intervention", model:"browser-model", reasoningEffort:"low", orchestrationPlan:{ ...guarded, primary:{ model:"injected" } } });
assert.equal(task.modelSelection.model, "host-deep");
assert.equal(task.modelSelection.reasoningEffort, "high");
assert.equal(spawned.args[spawned.args.indexOf("--model") + 1], "host-deep");
assert.ok(!spawned.args.includes("browser-model"));
adapter.close();
assert.equal(adapter.status().lastTask.modelSelection.model, "host-deep");

// Exercise the public transports too, so callers receive the policy fields.
const transportEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("RESEARCH_MODEL_")));
const cli = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL("research-intelligence.mjs", import.meta.url)), "orchestrate", guarded.query], { encoding:"utf8", env:transportEnv }));
assert.equal(cli.primary.model, "gpt-6-astra");
assert.ok(cli.assignments.some((x) => x.role === "independent-reviewer"));
const requests = [
  { jsonrpc:"2.0", id:1, method:"tools/call", params:{ name:"orchestration_plan", arguments:{ query:guarded.query } } },
  { jsonrpc:"2.0", id:2, method:"tools/call", params:{ name:"context_pack", arguments:{ query:guarded.query, audience:"reviewer", include_sources:false } } }
];
const responses = execFileSync(process.execPath, [fileURLToPath(new URL("../mcp/server.mjs", import.meta.url))], {
  encoding:"utf8", env:transportEnv, input:requests.map((x) => JSON.stringify(x)).join("\n") + "\n"
}).trim().split("\n").map((x) => JSON.parse(x));
assert.equal(responses.length, 2);
assert.ok(responses.every((x) => x.result.isError === false));
assert.deepEqual(responses[0].result.structuredContent.primary, cli.primary);
assert.equal(responses[1].result.structuredContent.modelSelection.model, "gpt-6-astra");
console.log("Model tiering: policy, overrides, risk escalation, review budget, CLI/MCP/Context Pack and runtime dispatch OK");
