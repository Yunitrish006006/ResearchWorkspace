#!/usr/bin/env node
import readline from "node:readline";
import { loadKnowledge, resolveTask, graphForTopic, impactAnalysis, knowledgeSummary, verificationPlan } from "../intelligence/research-knowledge.mjs";
import { buildOrchestrationPlan } from "../intelligence/orchestration-plan.mjs";
import { buildContextPack } from "../intelligence/context-pack.mjs";
import { buildSourceIndex, searchSources } from "../intelligence/source-index.mjs";
import { buildVerificationGraph } from "../intelligence/verification-graph.mjs";
import { researchChangeIntelligence } from "../intelligence/change-intelligence.mjs";
import { replayFrame, replayTimeline } from "../intelligence/research-replay.mjs";
import { renderGraphV2 } from "../scripts/render-graph-v2.mjs";
import { repositoryStatusSummary } from "../intelligence/repository-status.mjs";
import { buildClaimEvidenceMatrix } from "../intelligence/claim-evidence-matrix.mjs";
import { loadVerificationState } from "../intelligence/verification-state.mjs";

const SERVER_NAME="research-workspace-intelligence";
const SERVER_VERSION="0.1.0";
const schema=(properties,required=[])=>({type:"object",additionalProperties:false,properties,required});
const TOOLS=Object.freeze([
  {name:"resolve_task",description:"Resolve a research task to likely Topics, Claims, risks and bounded research roles.",inputSchema:schema({query:{type:"string",minLength:1}},["query"])},
  {name:"orchestration_plan",description:"Build the deterministic Totem-parity research orchestration plan.",inputSchema:schema({query:{type:"string",minLength:1},topic_id:{type:["string","null"],default:null},claim_id:{type:["string","null"],default:null},changed_topics:{type:"array",items:{type:"string"},default:[]},changed_files:{type:"array",items:{type:"string"},default:[]}},["query"])},
  {name:"graph",description:"Return the semantic neighborhood for one research Topic.",inputSchema:schema({topic_id:{type:"string",minLength:1},depth:{type:"integer",minimum:1,maximum:4,default:2}},["topic_id"])},
  {name:"search",description:"Search the thesis source/document index with repository, path and line provenance.",inputSchema:schema({query:{type:"string",minLength:1},limit:{type:"integer",minimum:1,maximum:40,default:12}},["query"])},
  {name:"context_pack",description:"Build a bounded audience-specific research Context Pack.",inputSchema:schema({query:{type:"string",minLength:1},audience:{type:"string",default:"research-synthesizer"},topic_id:{type:["string","null"],default:null},max_tokens:{type:"integer",minimum:1000,maximum:40000,default:8000},include_sources:{type:"boolean",default:true}},["query"])},
  {name:"impact",description:"Map changed thesis files/Topics to directly changed and propagated Claims.",inputSchema:schema({changed_files:{type:"array",items:{type:"string"},default:[]},changed_topics:{type:"array",items:{type:"string"},default:[]}})},
  {name:"verification_plan",description:"Return evidence/verification checks implied by the research impact surface.",inputSchema:schema({query:{type:"string",default:""},changed_topics:{type:"array",items:{type:"string"},default:[]},changed_files:{type:"array",items:{type:"string"},default:[]}})},
  {name:"test_plan",description:"Compatibility alias for verification_plan.",inputSchema:schema({query:{type:"string",default:""},changed_topics:{type:"array",items:{type:"string"},default:[]},changed_files:{type:"array",items:{type:"string"},default:[]}})},
  {name:"verification_graph",description:"Return Claim/Evidence/Review nodes and validated-by/supported-by coverage.",inputSchema:schema({})},
  {name:"verification_state",description:"Return latest runtime verification state per target.",inputSchema:schema({})},
  {name:"change_intelligence",description:"Return semantic research changes plus Claim/Topic impact propagation.",inputSchema:schema({changed_files:{type:"array",items:{type:"string"},default:[]},changed_topics:{type:"array",items:{type:"string"},default:[]}})},
  {name:"replay",description:"Return Research Replay timeline or one historical frame.",inputSchema:schema({sequence:{type:["integer","null"],default:null}})},
  {name:"repository_status",description:"Report local ResearchWorkspace/thesis repository branch, HEAD, dirty state and snapshot drift.",inputSchema:schema({})},
  {name:"claim_evidence_matrix",description:"Return the current Claim-to-Evidence traceability matrix.",inputSchema:schema({})},
  {name:"refresh_index",description:"Rebuild the thesis source/document index and regenerate viewer data.",inputSchema:schema({})},
  {name:"summary",description:"Return counts and snapshot metadata for ResearchWorkspace.",inputSchema:schema({})}
]);

function callTool(name,args={}){
  const knowledge=loadKnowledge();
  switch(name){
    case"resolve_task":return resolveTask(args.query,knowledge);
    case"orchestration_plan":return buildOrchestrationPlan({query:args.query,topicId:args.topic_id??null,claimId:args.claim_id??null,changedTopics:args.changed_topics??[],changedFiles:args.changed_files??[],knowledge});
    case"graph":return graphForTopic(args.topic_id,{depth:args.depth??2,knowledge});
    case"search":return searchSources(args.query,{limit:args.limit??12});
    case"context_pack":return buildContextPack(args.query,{audience:args.audience??"research-synthesizer",topicId:args.topic_id??null,maxTokens:args.max_tokens??8000,includeSources:args.include_sources!==false,knowledge});
    case"impact":return impactAnalysis({changedFiles:args.changed_files??[],changedTopics:args.changed_topics??[]},knowledge);
    case"verification_plan":
    case"test_plan":return verificationPlan({query:args.query??"",changedTopics:args.changed_topics??[],changedFiles:args.changed_files??[]},knowledge);
    case"verification_graph":return buildVerificationGraph(knowledge);
    case"verification_state":return loadVerificationState();
    case"change_intelligence":return researchChangeIntelligence({changedFiles:args.changed_files??[],changedTopics:args.changed_topics??[],knowledge});
    case"replay":return args.sequence==null?replayTimeline():replayFrame(args.sequence);
    case"repository_status":return repositoryStatusSummary({knowledge});
    case"claim_evidence_matrix":return buildClaimEvidenceMatrix(knowledge);
    case"refresh_index":{
      const index=buildSourceIndex();
      const graph=renderGraphV2({knowledge});
      return{generatedAt:index.generatedAt,files:index.files,chunks:index.chunks.length,rootPresent:index.rootPresent,graph};
    }
    case"summary":return knowledgeSummary(knowledge);
    default:throw new Error(`Unknown tool: ${name}`);
  }
}

function send(message){process.stdout.write(JSON.stringify(message)+"\n")}
function result(value){return{content:[{type:"text",text:JSON.stringify(value,null,2)}],structuredContent:value,isError:false}}
function errorResult(error){return{content:[{type:"text",text:error instanceof Error?error.message:String(error)}],isError:true}}
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on("line",(line)=>{
  if(!line.trim())return;
  let request;
  try{request=JSON.parse(line)}catch{send({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}});return}
  const id=Object.hasOwn(request,"id")?request.id:null;
  try{
    if(request.method==="initialize"){send({jsonrpc:"2.0",id,result:{protocolVersion:request.params?.protocolVersion||"2025-06-18",capabilities:{tools:{listChanged:false}},serverInfo:{name:SERVER_NAME,version:SERVER_VERSION}}});return}
    if(request.method==="notifications/initialized"||request.method==="initialized")return;
    if(request.method==="ping"){send({jsonrpc:"2.0",id,result:{}});return}
    if(request.method==="tools/list"){send({jsonrpc:"2.0",id,result:{tools:TOOLS}});return}
    if(request.method==="tools/call"){
      try{send({jsonrpc:"2.0",id,result:result(callTool(request.params?.name,request.params?.arguments??{}))})}
      catch(error){send({jsonrpc:"2.0",id,result:errorResult(error)})}
      return;
    }
    if(id!==null)send({jsonrpc:"2.0",id,error:{code:-32601,message:`Method not found: ${request.method}`}})
  }catch(error){if(id!==null)send({jsonrpc:"2.0",id,error:{code:-32603,message:"Internal error",data:String(error)}})}
});
