import fs from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./research-knowledge.mjs";

const statePath=path.join(workspaceRoot,".research-index","verification-state.json");
const TYPES=new Set(["verification_started","verification_passed","verification_failed"]);

function readRaw(){
  if(!fs.existsSync(statePath))return{schemaVersion:2,events:[]};
  try{const parsed=JSON.parse(fs.readFileSync(statePath,"utf8"));return{schemaVersion:2,events:Array.isArray(parsed.events)?parsed.events:[]}}
  catch{return{schemaVersion:2,events:[]}}
}
function saveRaw(data){
  fs.mkdirSync(path.dirname(statePath),{recursive:true});
  data.events=data.events.slice(-10000);
  fs.writeFileSync(statePath,JSON.stringify(data,null,2)+"\n");
}
export function foldVerificationEvents(events=[]){
  const latest=new Map();
  for(const event of events){
    if(!TYPES.has(event.type)||!event.targetId)continue;
    latest.set(event.targetId,event);
  }
  const values=[...latest.values()];
  return Object.freeze({
    schemaVersion:2,
    updatedAt:values.sort((a,b)=>Number(a.sequence??0)-Number(b.sequence??0)).at(-1)?.timestamp??null,
    latest:values,
    runningTargetIds:values.filter(x=>x.type==="verification_started").map(x=>x.targetId),
    passedTargetIds:values.filter(x=>x.type==="verification_passed").map(x=>x.targetId),
    failedTargetIds:values.filter(x=>x.type==="verification_failed").map(x=>x.targetId)
  });
}
export function loadVerificationState(){return foldVerificationEvents(readRaw().events)}
export function appendVerificationEvent(event){
  if(!TYPES.has(event?.type))throw new Error("Unsupported verification event type: "+event?.type);
  if(!String(event.targetId||"").trim())throw new Error("verification targetId is required");
  const data=readRaw();
  const sequence=Number.isFinite(Number(event.sequence))?Math.floor(Number(event.sequence)):Number(data.events.at(-1)?.sequence??0)+1;
  const timestamp=event.timestamp??event.at??new Date().toISOString();
  const stored={...event,sequence,timestamp,at:timestamp,targetId:String(event.targetId).trim()};
  data.events.push(stored);saveRaw(data);
  return Object.freeze({event:stored,state:foldVerificationEvents(data.events)});
}
export function verificationStatePath(){return statePath}
