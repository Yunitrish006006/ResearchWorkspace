import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../mcp/server.mjs",import.meta.url),"utf8");
for(const name of ["resolve_task","orchestration_plan","graph","search","context_pack","impact","verification_plan","test_plan","verification_graph","change_intelligence","replay","refresh_index","summary"])assert.ok(source.includes(`name:"${name}"`),name);
console.log("MCP tool surface OK");
