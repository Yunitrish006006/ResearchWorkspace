#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const viewer=path.join(root,"viewer_flutter");
const include=["lib","web","assets","pubspec.yaml","pubspec.lock","analysis_options.yaml"];

function walk(target){
  if(!fs.existsSync(target))return[];
  const stat=fs.statSync(target);
  if(stat.isFile())return[target];
  const out=[];
  for(const entry of fs.readdirSync(target).sort()){
    const full=path.join(target,entry),child=fs.statSync(full);
    if(child.isDirectory())out.push(...walk(full));else if(child.isFile())out.push(full);
  }
  return out;
}
const files=include.flatMap((entry)=>walk(path.join(viewer,entry))).filter((file)=>!file.includes(path.sep+"build"+path.sep)).sort();
const hash=crypto.createHash("sha256");
for(const file of files){
  const rel=path.relative(root,file).replaceAll(path.sep,"/");
  hash.update(rel);hash.update("\0");hash.update(fs.readFileSync(file));hash.update("\0");
}
process.stdout.write(hash.digest("hex")+"\n");
