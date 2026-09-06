import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const scripts=[
 "validate-workspace.mjs","validate-orchestration.mjs","validate-semantic-lod.mjs",
 "validate-verification-graph.mjs","validate-verification-telemetry.mjs","validate-change-intelligence.mjs","validate-replay.mjs",
 "validate-agent-adapter.mjs","validate-conversation-sync.mjs","validate-mcp.mjs",
 "validate-local-viewer.mjs","validate-totem-parity.mjs","validate-repository-integration.mjs","validate-artifact-drift.mjs","validate-source-mapping.mjs",
 "validate-remote-bridge.mjs"
];
for(const script of scripts){
 const run=spawnSync(process.execPath,[fileURLToPath(new URL(script,import.meta.url))],{stdio:"inherit"});
 if(run.status!==0)process.exit(run.status??1);
}
console.log("All ResearchWorkspace validators passed");
