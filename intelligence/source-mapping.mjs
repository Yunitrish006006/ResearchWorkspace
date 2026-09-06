import { loadKnowledge } from "./research-knowledge.mjs";
import { loadSourceIndex } from "./source-index.mjs";

const STOP=new Set(["research","result","results","method","methods","study","evidence","model","data","thesis","claim","using","based","with","from","this","that","研究","結果","方法","資料","模型","論文","實驗","驗證","證據","使用","進行"]);

function normalize(value){return String(value||"").toLowerCase().normalize("NFKC")}
function lexicalUnits(value){
  const text=normalize(value),units=new Set();
  for(const token of text.match(/[a-z0-9][a-z0-9_-]{2,}/g)??[])if(!STOP.has(token))units.add(token);
  const cjk=(text.match(/[\p{Script=Han}]+/gu)??[]).join("");
  for(let i=0;i<cjk.length-1;i++){
    const gram=cjk.slice(i,i+2);if(!STOP.has(gram))units.add(gram);
  }
  return units;
}
function overlapScore(needle,haystack){
  if(!needle.size)return{score:0,matched:[]};
  const matched=[...needle].filter(x=>haystack.has(x));
  const denominator=Math.max(4,Math.min(needle.size,16));
  return{score:Math.min(1,matched.length/denominator),matched};
}
function exactMappings(file,knowledge){
  const out=[];
  for(const claim of knowledge.claims){
    if((claim.sources??[]).some(source=>file===source||file.endsWith(source)||source.endsWith(file))){
      out.push({entityId:claim.id,entityType:"claim",topicId:claim.ownerId,confidence:1,reason:"registered-claim-source"});
    }
  }
  for(const evidence of knowledge.evidence){
    if(file===evidence.path||file.startsWith(evidence.path)||evidence.path.startsWith(file)){
      const claim=knowledge.claimById.get(evidence.claimId);
      out.push({entityId:evidence.id,entityType:"evidence",claimId:evidence.claimId,topicId:claim?.ownerId??null,confidence:1,reason:"registered-evidence-path"});
      out.push({entityId:evidence.claimId,entityType:"claim",topicId:claim?.ownerId??null,confidence:.98,reason:"evidence-owner"});
    }
  }
  return out;
}
function dedupe(mappings){
  const best=new Map();
  for(const item of mappings){
    const prior=best.get(item.entityId);
    if(!prior||item.confidence>prior.confidence)best.set(item.entityId,item);
  }
  return [...best.values()].sort((a,b)=>b.confidence-a.confidence||a.entityId.localeCompare(b.entityId));
}
export function mapSourceFilesToEntities(files,{knowledge=loadKnowledge(),index=loadSourceIndex()}={}){
  const normalized=[...new Set(files.map(x=>String(x||"").replaceAll("\\","/").replace(/^\.\//,"")).filter(Boolean))];
  return normalized.map(file=>{
    const exact=exactMappings(file,knowledge);
    if(exact.length)return{file,mappings:dedupe(exact),mappingMode:"registered"};
    const chunks=index.chunks.filter(x=>x.path===file);
    if(!chunks.length)return{file,mappings:[],mappingMode:"unmapped"};
    const contentUnits=lexicalUnits(chunks.map(x=>x.text).join("\n"));
    const candidates=[];
    for(const claim of knowledge.claims){
      const topic=knowledge.topicById.get(claim.ownerId);
      const units=lexicalUnits([claim.title,claim.summary,topic?.name,topic?.summary].join(" "));
      const hit=overlapScore(units,contentUnits);
      if(hit.matched.length>=3&&hit.score>=.19){
        candidates.push({
          entityId:claim.id,entityType:"claim",topicId:claim.ownerId,
          confidence:Number(Math.min(.89,.5+hit.score).toFixed(3)),
          reason:"high-confidence-content-overlap",matchedUnits:hit.matched.slice(0,12)
        });
      }
    }
    const best=dedupe(candidates).slice(0,4);
    return{file,mappings:best,mappingMode:best.length?"content":"unmapped"};
  });
}
export function mappedImpactSurface(files,options={}){
  const mappings=mapSourceFilesToEntities(files,options);
  return{
    files:mappings,
    entityIds:[...new Set(mappings.flatMap(x=>x.mappings.map(y=>y.entityId)))],
    claimIds:[...new Set(mappings.flatMap(x=>x.mappings.flatMap(y=>y.entityType==="claim"?[y.entityId]:y.claimId?[y.claimId]:[])))],
    topicIds:[...new Set(mappings.flatMap(x=>x.mappings.map(y=>y.topicId).filter(Boolean)))]
  };
}
