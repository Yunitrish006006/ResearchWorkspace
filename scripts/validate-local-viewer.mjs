import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./serve-local-viewer.mjs",import.meta.url),"utf8");
assert.ok(source.includes('const host="127.0.0.1"'));
for(const route of ["/api/health","/api/agent-adapter","/api/graph-data","/api/repository-status","/api/claim-evidence-matrix","/api/viewer-settings","/api/activity","/api/orchestration-plan","/api/change-intelligence","/api/verification-state","/api/replay","/api/replay/frame","/api/prompt","/api/refresh","/api/conversation","/api/conversation/draft","/api/conversation/prompt","/api/conversation/cancel"])assert.ok(source.includes(route),route);
assert.ok(source.includes("MAX_BODY=64*1024"));assert.ok(source.includes("MAX_PROMPT=8192"));
assert.ok(source.includes("createAgentAdapter"));assert.ok(source.includes("recordReplayCheckpoint"));
console.log("Loopback Local Bridge / Agent / Conversation contract OK");
