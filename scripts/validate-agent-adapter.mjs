import assert from "node:assert/strict";
import { adapterConfiguration, buildCodexArgs, agentAdapterStatus } from "../intelligence/agent-adapter.mjs";
assert.equal(agentAdapterStatus({}).enabled,false);
const cfg=adapterConfiguration({RESEARCH_AGENT_ADAPTER:"codex",RESEARCH_CODEX_CWD:process.cwd(),RESEARCH_CODEX_SANDBOX:"workspace-write"});
const cmd=buildCodexArgs({prompt:"review evidence",config:cfg});
assert.equal(cmd.executable,"codex");assert.ok(cmd.args.includes("--json"));assert.ok(cmd.args.includes("--sandbox"));
assert.ok(!cmd.args.includes("--full-auto"));assert.ok(!cmd.args.some(x=>/dangerously|bypass/i.test(x)));
console.log("Codex Agent Adapter safety contract OK");
