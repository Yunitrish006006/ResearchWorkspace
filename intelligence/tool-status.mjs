import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifestPath=path.join(root,"data","tool-surface.json");

export function loadToolSurface(){
  return JSON.parse(fs.readFileSync(manifestPath,"utf8"));
}

function requiredPaths(group){
  return [...new Set([group.entry,...(group.files??[])].filter(Boolean))];
}

export function toolSurfaceStatus(){
  const manifest=loadToolSurface();
  const groups=manifest.groups.map((group)=>{
    const paths=requiredPaths(group);
    const missingPaths=paths.filter((rel)=>!fs.existsSync(path.join(root,rel)));
    return Object.freeze({
      id:group.id,
      kind:group.kind,
      entry:group.entry,
      complete:missingPaths.length===0,
      requiredPathCount:paths.length,
      missingPaths:Object.freeze(missingPaths),
      commandCount:(group.commands??group.actions??group.tools??group.scripts??[]).length
    });
  });
  return Object.freeze({
    schemaVersion:1,
    reference:Object.freeze({...manifest.reference}),
    groups:Object.freeze(groups),
    totals:Object.freeze({
      groups:groups.length,
      complete:groups.filter((x)=>x.complete).length,
      incomplete:groups.filter((x)=>!x.complete).length
    })
  });
}
