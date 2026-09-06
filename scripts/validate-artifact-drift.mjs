import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { artifactDriftStatus } from "../intelligence/artifact-drift.mjs";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"artifact-drift-"));
const run=(args)=>execFileSync("git",args,{cwd:root,encoding:"utf8"});
run(["init"]);run(["config","user.email","test@example.com"]);run(["config","user.name","Test"]);
let commitClock=0;
function commit(file,body,message){
  const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,body);
  run(["add",file]);
  commitClock+=1;
  const date=new Date(Date.UTC(2026,0,1,0,0,commitClock)).toISOString();
  execFileSync("git",["commit","-m",message],{cwd:root,encoding:"utf8",env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}});
}
commit("docs/papers/thesis/thesis_draft_zh.tex","old thesis","thesis");
commit("docs/papers/ieee/paper.tex","old ieee","ieee");
commit("docs/thesis/presentation_outline_zh.md","old presentation","presentation");
commit("docs/thesis/thesis_sync_status_zh.md","old sync","sync");
commit("openspec/specs/research-contract/spec.md","new method","method changed");
const fakeStatus={repositories:[{id:"thesis",head:run(["rev-parse","HEAD"]).trim(),changedFiles:[]}]};
const status=artifactDriftStatus({root,repositoryStatus:fakeStatus});
assert.equal(status.available,true);
assert.ok(status.findings.some(x=>x.id==="thesis-method-drift"));
assert.ok(status.findings.some(x=>x.id==="ieee-research-drift"));
assert.ok(status.findings.some(x=>x.id==="presentation-research-drift"));
fs.rmSync(root,{recursive:true,force:true});
console.log("Thesis artifact drift detection OK");
