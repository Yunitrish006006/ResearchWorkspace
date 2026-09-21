import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { workspaceRoot } from "./research-knowledge.mjs";

const SCHEMA_VERSION=2;
const TEXT_EXTENSIONS=new Set([".md",".txt",".json",".bib",".ris",".csv",".tex",".py",".mjs",".js",".yaml",".yml"]);
const EXCLUDED_DIRS=new Set([".git","outputs",".venv","__pycache__","node_modules"]);
const INDEX_DIR=path.join(workspaceRoot,".research-index");
const INDEX_PATH=path.join(INDEX_DIR,"source-index.json");
const CHUNK_LINES=120;
const OVERLAP_LINES=20;

export function thesisRoot(){
  if(process.env.RESEARCH_THESIS_REPO)return path.resolve(process.env.RESEARCH_THESIS_REPO);
  const conventional=path.join(workspaceRoot,"..","Three-Factor-Digital-Twin");
  const school=path.join(workspaceRoot,"..","school");
  return fs.existsSync(conventional)?conventional:fs.existsSync(school)?school:conventional;
}
function normalizePath(value){return String(value||"").replaceAll("\\","/").replace(/^\.\//,"")}
function supported(relativePath){return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())}
function excluded(relativePath){return normalizePath(relativePath).split("/").some((part)=>EXCLUDED_DIRS.has(part))}
function hash(value){return crypto.createHash("sha256").update(value).digest("hex")}
function walk(root,current=root,out=[]){
  if(!fs.existsSync(current))return out;
  for(const entry of fs.readdirSync(current,{withFileTypes:true})){
    if(entry.isDirectory()&&EXCLUDED_DIRS.has(entry.name))continue;
    const full=path.join(current,entry.name);
    if(entry.isDirectory())walk(root,full,out);
    else{
      const relative=normalizePath(path.relative(root,full));
      if(supported(relative)&&!excluded(relative))out.push(full);
    }
  }
  return out;
}
function chunksForFile(root,file,chunkLines=CHUNK_LINES,overlap=OVERLAP_LINES){
  const text=fs.readFileSync(file,"utf8");
  const lines=text.split(/\r?\n/);
  const relativePath=normalizePath(path.relative(root,file));
  const chunks=[],step=Math.max(1,chunkLines-overlap);
  for(let start=0;start<lines.length;start+=step){
    const end=Math.min(lines.length,start+chunkLines),body=lines.slice(start,end).join("\n");
    if(body.trim())chunks.push({
      id:"source:thesis:"+relativePath+":"+(start+1)+"-"+end,
      repository:"Yunitrish006006/Three-Factor-Digital-Twin",
      path:relativePath,startLine:start+1,endLine:end,sha256:hash(body),text:body
    });
    if(end===lines.length)break;
  }
  return chunks;
}
function fileRecord(root,file,chunks){
  const relativePath=normalizePath(path.relative(root,file));
  const stat=fs.statSync(file),body=fs.readFileSync(file);
  return{path:relativePath,sha256:hash(body),bytes:stat.size,mtimeMs:Math.floor(stat.mtimeMs),chunkCount:chunks.length};
}
function save(index){
  fs.mkdirSync(INDEX_DIR,{recursive:true});
  fs.writeFileSync(INDEX_PATH,JSON.stringify(index,null,2)+"\n");
  return index;
}
function normalizedIndex(parsed){
  if(!parsed||!Array.isArray(parsed.chunks))return null;
  const records=Array.isArray(parsed.fileRecords)?parsed.fileRecords:[...new Set(parsed.chunks.map(x=>x.path))].map(p=>({path:p,chunkCount:parsed.chunks.filter(x=>x.path===p).length}));
  return{schemaVersion:SCHEMA_VERSION,generatedAt:parsed.generatedAt??null,repository:parsed.repository??"Yunitrish006006/Three-Factor-Digital-Twin",rootPresent:parsed.rootPresent===true,files:records.length,fileRecords:records,chunks:parsed.chunks};
}

export function buildSourceIndex({root=thesisRoot()}={}){
  const present=fs.existsSync(root),allChunks=[],records=[];
  if(present){
    for(const file of walk(root)){
      const chunks=chunksForFile(root,file);allChunks.push(...chunks);records.push(fileRecord(root,file,chunks));
    }
  }
  return save({
    schemaVersion:SCHEMA_VERSION,generatedAt:new Date().toISOString(),
    repository:"Yunitrish006006/Three-Factor-Digital-Twin",rootPresent:present,
    files:records.length,fileRecords:records.sort((a,b)=>a.path.localeCompare(b.path)),
    chunks:allChunks.sort((a,b)=>a.path.localeCompare(b.path)||a.startLine-b.startLine)
  });
}
export function loadSourceIndex(){
  if(!fs.existsSync(INDEX_PATH))return buildSourceIndex();
  try{return normalizedIndex(JSON.parse(fs.readFileSync(INDEX_PATH,"utf8")))??buildSourceIndex()}
  catch{return buildSourceIndex()}
}
export function refreshSourceIndex({files=[],root=thesisRoot(),index=loadSourceIndex()}={}){
  if(!fs.existsSync(root))return buildSourceIndex({root});
  const requested=[...new Set(files.map(normalizePath).filter(Boolean))];
  if(!requested.length)return{index,mode:"fresh",refreshedFiles:[],removedFiles:[]};
  const requestedSet=new Set(requested);
  const nextChunks=index.chunks.filter((chunk)=>!requestedSet.has(normalizePath(chunk.path)));
  const nextRecords=(index.fileRecords??[]).filter((record)=>!requestedSet.has(normalizePath(record.path)));
  const refreshedFiles=[],removedFiles=[];
  for(const relative of requested){
    const full=path.resolve(root,relative);
    const safe=full===root||(!path.relative(root,full).startsWith("..")&&!path.isAbsolute(path.relative(root,full)));
    if(!safe||!fs.existsSync(full)||!fs.statSync(full).isFile()||!supported(relative)||excluded(relative)){
      removedFiles.push(relative);continue;
    }
    const chunks=chunksForFile(root,full);nextChunks.push(...chunks);nextRecords.push(fileRecord(root,full,chunks));refreshedFiles.push(relative);
  }
  const next=save({
    schemaVersion:SCHEMA_VERSION,generatedAt:new Date().toISOString(),repository:index.repository,
    rootPresent:true,files:nextRecords.length,
    fileRecords:nextRecords.sort((a,b)=>a.path.localeCompare(b.path)),
    chunks:nextChunks.sort((a,b)=>a.path.localeCompare(b.path)||a.startLine-b.startLine)
  });
  return{index:next,mode:"incremental",refreshedFiles,removedFiles};
}
export function searchSources(query,{limit=12,index=loadSourceIndex()}={}){
  const tokens=String(query).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(x=>x.length>1);
  const results=index.chunks.map(chunk=>{
    const haystack=(chunk.path+"\n"+chunk.text).toLowerCase();
    const score=tokens.reduce((n,token)=>n+(haystack.includes(token)?1:0),0);
    return{...chunk,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,limit);
  return{query,results,freshness:{rootPresent:index.rootPresent,generatedAt:index.generatedAt}};
}
export const sourceIndexConfig=Object.freeze({schemaVersion:SCHEMA_VERSION,chunkLines:CHUNK_LINES,overlapLines:OVERLAP_LINES});
