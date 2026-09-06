#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const data=JSON.parse(fs.readFileSync(new URL("../data/totem-parity.json",import.meta.url),"utf8"));
const expected=data.reference.commit;
const raw=execFileSync("git",["ls-remote","https://github.com/"+data.reference.repository+".git","refs/heads/main"],{encoding:"utf8"}).trim();
const actual=raw.split(/\s+/)[0]||null;
if(!actual)throw new Error("Unable to resolve TotemWorkspace main HEAD");
if(actual!==expected){
  console.error("TotemWorkspace reference drift detected.");
  console.error("Audited ResearchWorkspace reference: "+expected);
  console.error("Current TotemWorkspace main:        "+actual);
  console.error("Re-audit the upstream changes and update ResearchWorkspace parity before marking CI green.");
  process.exit(1);
}
console.log("TotemWorkspace reference HEAD matches audited parity baseline: "+actual);
