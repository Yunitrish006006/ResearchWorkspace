import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const data=JSON.parse(fs.readFileSync(path.join(root,"data","totem-parity.json"),"utf8"));
assert.ok(data.reference.repository==="Yunitrish006006/TotemWorkspace");
assert.ok(data.capabilities.length>=18);
for(const capability of data.capabilities){
  assert.ok(["implemented","not-applicable"].includes(capability.status),capability.id+" is not full parity: "+capability.status);
  if(capability.status==="implemented"){
    assert.ok(capability.evidence.length>0,capability.id+" must name evidence files");
    for(const rel of capability.evidence){
      assert.ok(fs.existsSync(path.join(root,rel)),capability.id+" missing evidence: "+rel);
    }
    assert.equal((capability.missing??[]).length,0,capability.id+" cannot be implemented with declared missing work");
  }
}
console.log("TotemWorkspace full-parity ledger OK · "+data.capabilities.length+" capabilities implemented/not-applicable");
