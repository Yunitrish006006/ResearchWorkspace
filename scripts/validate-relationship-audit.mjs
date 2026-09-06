import assert from "node:assert/strict";
import fs from "node:fs";
import { loadKnowledge, resolveTask } from "../intelligence/research-knowledge.mjs";

const knowledge=loadKnowledge();
const audit=knowledge.relationshipAudit;
assert.equal(audit.schemaVersion,1);
assert.equal(audit.relationCount,knowledge.relations.length);
for(const relation of knowledge.relations){
  const entry=audit.relationOverrides[relation.id];
  assert.ok(entry,"missing relationship audit "+relation.id);
  assert.equal(entry.auditStatus,"verified",relation.id);
  assert.equal(entry.type,relation.type,relation.id+" type drift");
  assert.equal(entry.from,relation.from,relation.id+" from drift");
  assert.equal(entry.to,relation.to,relation.id+" to drift");
}
for(const type of ["supports","uses-method","grounded-in","limits"]){
  assert.ok(knowledge.relations.some(x=>x.type===type),"missing curated relation type "+type);
}
assert.equal(resolveTask("枕頭 E7",knowledge).topics[0].id,"evidence");
assert.ok(resolveTask("CU-BEMS 持續性",knowledge).topics.some(x=>x.id==="public"));
const doc=fs.readFileSync(new URL("../docs/relationship-audit-2026-09-06.md",import.meta.url),"utf8");
assert.ok(doc.includes("6/6 cross-Claim relations reviewed"));
console.log("Research relationship audit and aliases OK");
