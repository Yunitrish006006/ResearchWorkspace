#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadToolSurface, toolSurfaceStatus } from "../intelligence/tool-status.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifest=loadToolSurface();
const status=toolSurfaceStatus();
assert.equal(status.totals.incomplete,0,"all ResearchWorkspace tool groups must have their required files");

const source=(rel)=>fs.readFileSync(path.join(root,rel),"utf8");
const hasCase=(text,name)=>text.includes('case "'+name+'"')||text.includes('case"'+name+'"')||text.includes("case '"+name+"'")||text.includes("case'"+name+"'");

for(const group of manifest.groups){
  const text=source(group.entry);
  if(group.kind==="cli"){
    for(const command of group.commands??[]) assert.ok(hasCase(text,command)||text.includes(" "+command+" "),group.id+" missing CLI command "+command);
  }else if(group.kind==="mcp"){
    for(const tool of group.tools??[]) assert.ok(text.includes('name:"'+tool+'"')||text.includes('name: "'+tool+'"'),group.id+" missing MCP tool "+tool);
  }else if(group.kind==="http"){
    for(const route of group.routes??[]) assert.ok(text.includes('"'+route+'"')||text.includes("'"+route+"'"),group.id+" missing route "+route);
    for(const contract of group.contracts??[]) assert.ok(text.includes(contract),group.id+" missing HTTP contract "+contract);
  }else if(group.kind==="shell"){
    const syntax=spawnSync("bash",["-n",path.join(root,group.entry)],{encoding:"utf8"});
    assert.equal(syntax.status,0,syntax.stderr);
    for(const action of group.actions??[]) assert.ok(text.includes(action+")")||text.includes(action+" |")||text.includes(action+";"),group.id+" missing shell action "+action);
    for(const contract of group.contracts??[]) assert.ok(text.includes(contract),group.id+" missing shell contract "+contract);
  }else if(group.kind==="node-package"){
    const pkg=JSON.parse(text);
    for(const script of group.scripts??[]) assert.ok(pkg.scripts?.[script],group.id+" missing npm script "+script);
    for(const rel of group.files??[]) assert.ok(fs.existsSync(path.join(root,rel)),group.id+" missing "+rel);
    const config=source("tools/codex-discord/src/config.mjs");
    const runner=source("tools/codex-discord/src/codex-runner.mjs");
    for(const contract of group.contracts??[]) assert.ok(config.includes(contract)||runner.includes(contract),group.id+" missing contract "+contract);
    assert.ok(!config.includes("TOTEM_WORKSPACE_SYNC_"),"Research CodexDiscord must not depend on Totem workspace-sync environment names");
    assert.ok(!runner.includes("--dangerously-bypass-approvals-and-sandbox"),"CodexDiscord must not force dangerous sandbox bypass");
  }
}

const bridge=source("scripts/serve-local-viewer.mjs");
const sync=source("tools/codex-discord/src/workspace-sync.mjs");
for(const route of ["/api/conversation","/api/conversation/prompt","/api/conversation/status","/api/conversation/cancel"]){
  assert.ok(sync.includes(route),"CodexDiscord workspace sync must use "+route);
  assert.ok(bridge.includes(route),"Local Bridge must implement "+route);
}
const adapter=source("intelligence/agent-adapter.mjs");
assert.ok(adapter.includes('["exec","--json","--skip-git-repo-check","--sandbox",config.sandbox,"--cd",config.cwd]'));
assert.ok(adapter.includes('child.stdin?.end?.(promptEnvelope'));
assert.ok(!adapter.includes("--full-auto"));
assert.ok(!adapter.includes("--dangerously-bypass-approvals-and-sandbox"));

const refArg=process.argv.indexOf("--reference-root");
if(refArg>=0){
  const referenceRoot=path.resolve(process.argv[refArg+1]||"");
  assert.ok(referenceRoot&&fs.existsSync(referenceRoot),"--reference-root must point to a TotemWorkspace checkout");
  const head=execFileSync("git",["rev-parse","HEAD"],{cwd:referenceRoot,encoding:"utf8"}).trim();
  assert.equal(head,manifest.reference.commit,"Totem tool audit checkout must match the pinned reference commit");
  const actual=execFileSync("git",["ls-files","tools"],{cwd:referenceRoot,encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean).sort();
  const expected=[...manifest.referenceToolFiles].sort();
  assert.equal(actual.length,manifest.reference.expectedToolFiles,"Totem tools/ file count drifted");
  assert.deepEqual(actual,expected,"Totem tools/ file surface drifted; re-audit before marking Research tools complete");
}

console.log("Research tool surface OK",JSON.stringify(status.totals));
