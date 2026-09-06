import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { thesisRoot } from "./source-index.mjs";
import { repositoryStatusSummary } from "./repository-status.mjs";

export const ARTIFACT_GROUPS=Object.freeze([
  {id:"method-source",label:"Method / OpenSpec",paths:["openspec/specs","openspec/changes/stabilize-thesis-evidence","docs/models","digital_twin"]},
  {id:"evidence-source",label:"Experiments / Evidence",paths:["docs/experiments","scripts/run_all_thesis_experiments.py","scripts/verify_thesis_results.py","scripts/run_hybrid_residual_experiment.py","outputs/data"]},
  {id:"thesis-manuscript",label:"Chinese Thesis",paths:["docs/thesis/thesis_draft_zh.md","docs/papers/thesis/thesis_draft_zh.tex"]},
  {id:"ieee-manuscript",label:"IEEE Paper",paths:["docs/papers/ieee/paper.tex","docs/papers/ieee/references.bib"]},
  {id:"presentation",label:"Presentation",paths:["docs/thesis/presentation_outline_zh.md","docs/thesis/presentation_outline_zh_30min.md","docs/thesis/presentation_speaker_notes_zh_30min.md","docs/papers/thesis/thesis_presentation_zh.pptx","docs/papers/thesis/thesis_presentation_zh_30min.pptx"]},
  {id:"figures",label:"Figures",paths:["docs/papers/thesis/assets","docs/papers/ieee/assets"]},
  {id:"generated-thesis",label:"Generated Thesis",paths:["docs/papers/thesis/thesis_draft_zh.docx","docs/papers/thesis/thesis_draft_zh.pdf"]},
  {id:"sync-status",label:"Synchronization Status",paths:["docs/thesis/thesis_sync_status_zh.md","docs/thesis/method_status_inventory_zh.md"]}
]);

const RULES=Object.freeze([
  {id:"thesis-method-drift",sources:["method-source","evidence-source"],target:"thesis-manuscript",message:"Method or evidence is newer than the Chinese thesis manuscript."},
  {id:"ieee-research-drift",sources:["method-source","evidence-source","thesis-manuscript"],target:"ieee-manuscript",message:"Research method/evidence/thesis is newer than the IEEE manuscript."},
  {id:"presentation-research-drift",sources:["method-source","evidence-source","thesis-manuscript"],target:"presentation",message:"Research method/evidence/thesis is newer than presentation artifacts."},
  {id:"generated-thesis-drift",sources:["thesis-manuscript","figures"],target:"generated-thesis",message:"Thesis source or figures are newer than generated DOCX/PDF artifacts."},
  {id:"sync-status-drift",sources:["method-source","evidence-source","thesis-manuscript","ieee-manuscript","presentation"],target:"sync-status",message:"Research-facing artifacts are newer than the synchronization status inventory."}
]);

function git(args,cwd){
  try{return execFileSync("git",args,{cwd,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim()}catch{return null}
}
function groupCommit(root,group){
  const raw=git(["log","-1","--format=%H%x09%ct","--",...group.paths],root);
  if(!raw)return{id:group.id,label:group.label,lastCommit:null,timestamp:null,paths:group.paths};
  const [commit,epoch]=raw.split("\t");
  return{id:group.id,label:group.label,lastCommit:commit||null,timestamp:Number(epoch)||null,paths:group.paths};
}
function matchesPath(file,pattern){
  const normalized=String(file||"").replaceAll("\\","/");
  return normalized===pattern||normalized.startsWith(pattern.endsWith("/")?pattern:pattern+"/");
}
function dirtyGroups(changedFiles){
  const groups=[];
  for(const group of ARTIFACT_GROUPS){
    const matches=changedFiles.filter(file=>group.paths.some(pattern=>matchesPath(file,pattern)));
    if(matches.length)groups.push({groupId:group.id,files:matches});
  }
  return groups;
}
export function artifactDriftStatus({root=thesisRoot(),repositoryStatus=null}={}){
  const present=fs.existsSync(root)&&fs.existsSync(path.join(root,".git"));
  if(!present)return Object.freeze({available:false,rootPresent:false,generatedAt:new Date().toISOString(),groups:[],dirtyGroups:[],findings:[],driftCount:0});
  const repoStatus=repositoryStatus??repositoryStatusSummary();
  const thesis=repoStatus.repositories?.find(x=>x.id==="thesis");
  const changedFiles=thesis?.changedFiles??[];
  const groups=ARTIFACT_GROUPS.map(group=>groupCommit(root,group));
  const byId=new Map(groups.map(x=>[x.id,x]));
  const dirty=dirtyGroups(changedFiles);
  const dirtyIds=new Set(dirty.map(x=>x.groupId));
  const findings=[];
  for(const rule of RULES){
    const target=byId.get(rule.target);
    const sourceStates=rule.sources.map(id=>byId.get(id)).filter(Boolean);
    const newest=sourceStates.filter(x=>x.timestamp!=null).sort((a,b)=>b.timestamp-a.timestamp)[0]??null;
    const committedDrift=Boolean(newest?.timestamp&&(!target?.timestamp||newest.timestamp>target.timestamp));
    const dirtyDrift=rule.sources.some(id=>dirtyIds.has(id))&&!dirtyIds.has(rule.target);
    if(committedDrift||dirtyDrift){
      findings.push({
        id:rule.id,severity:"warning",message:rule.message,targetGroupId:rule.target,
        sourceGroupIds:rule.sources,reason:dirtyDrift?"uncommitted-source-change":"newer-source-commit",
        sourceCommit:newest?.lastCommit??null,targetCommit:target?.lastCommit??null,
        sourceTimestamp:newest?.timestamp??null,targetTimestamp:target?.timestamp??null
      });
    }
  }
  return Object.freeze({
    schemaVersion:1,available:true,rootPresent:true,generatedAt:new Date().toISOString(),
    thesisHead:thesis?.head??git(["rev-parse","HEAD"],root),groups,dirtyGroups:dirty,findings,
    driftCount:findings.length,affectedArtifactGroupIds:[...new Set(findings.map(x=>x.targetGroupId))]
  });
}
