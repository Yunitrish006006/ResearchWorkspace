#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const config=JSON.parse(fs.readFileSync(path.join(root,"data","reference-behavior-contracts.json"),"utf8"));
assert.equal(config.reference.repository,"Yunitrish006006/TotemWorkspace");
assert.ok(config.contracts.length>=9);

function checkTokens(filePath,tokens,{forbidden=[],label}={}){
  assert.ok(fs.existsSync(filePath),label+" path missing: "+filePath);
  const source=fs.readFileSync(filePath,"utf8");
  for(const token of tokens??[]){
    assert.ok(source.includes(token),label+" missing behavior token: "+token);
  }
  for(const token of forbidden??[]){
    assert.ok(!source.includes(token),label+" contains forbidden behavior token: "+token);
  }
}

for(const contract of config.contracts){
  assert.ok(contract.id&&contract.referencePath&&contract.researchPath,"invalid behavior contract");
  checkTokens(path.join(root,contract.researchPath),contract.researchTokens,{
    forbidden:contract.researchForbidden??[],
    label:"Research "+contract.id
  });
}

const referenceRoot=process.env.TOTEM_REFERENCE_ROOT;
if(referenceRoot){
  const head=String(
    (await import("node:child_process")).execFileSync(
      "git",["rev-parse","HEAD"],{cwd:referenceRoot,encoding:"utf8"}
    )
  ).trim();
  assert.equal(head,config.reference.commit,"Totem behavior reference commit drift");
  for(const contract of config.contracts){
    checkTokens(path.join(referenceRoot,contract.referencePath),contract.referenceTokens,{
      forbidden:contract.referenceForbidden??[],
      label:"Totem "+contract.id
    });
  }
  console.log("Totem ↔ Research behavioral contracts verified against exact reference");
}else{
  console.log("Research behavioral parity contracts OK (upstream token audit skipped)");
}
