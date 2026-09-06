#!/usr/bin/env node
import { buildContextPack } from "../intelligence/context-pack.mjs";
import { buildOrchestrationPlan } from "../intelligence/orchestration-plan.mjs";
import { buildSourceIndex, searchSources } from "../intelligence/source-index.mjs";
import { graphForTopic, impactAnalysis, knowledgeSummary, loadKnowledge, resolveTask, verificationPlan } from "../intelligence/research-knowledge.mjs";
import { buildVerificationGraph } from "../intelligence/verification-graph.mjs";
import { researchChangeIntelligence } from "../intelligence/change-intelligence.mjs";
import { replayFrame, replayTimeline } from "../intelligence/research-replay.mjs";
import { renderGraphV2 } from "./render-graph-v2.mjs";
import { loadVerificationState } from "../intelligence/verification-state.mjs";
import { artifactDriftStatus } from "../intelligence/artifact-drift.mjs";
import { repositoryStatusSummary } from "../intelligence/repository-status.mjs";
import { buildClaimEvidenceMatrix } from "../intelligence/claim-evidence-matrix.mjs";

const [command, ...args] = process.argv.slice(2);
const knowledge = loadKnowledge();
const list = (value) => String(value || "").split(",").map((x) => x.trim()).filter(Boolean);
const print = (value) => console.log(JSON.stringify(value, null, 2));

switch (command) {
  case "summary": print(knowledgeSummary(knowledge)); break;
  case "resolve": print(resolveTask(args.join(" "), knowledge)); break;
  case "orchestrate": print(buildOrchestrationPlan({ query:args[0] ?? "", topicId:args[1] ?? null, knowledge })); break;
  case "graph": print(graphForTopic(args[0], { depth:Number(args[1] || 2), knowledge })); break;
  case "search": print(searchSources(args[0] ?? "", { limit:Number(args[1] || 12) })); break;
  case "context": print(buildContextPack(args[0] ?? "", { audience:args[1] ?? "research-synthesizer", topicId:args[2] ?? null, knowledge })); break;
  case "impact": print(impactAnalysis({ changedFiles:list(args[0]), changedTopics:list(args[1]) }, knowledge)); break;
  case "verification-plan": print(verificationPlan({ query:args[0] ?? "", changedTopics:list(args[1]), changedFiles:list(args[2]) }, knowledge)); break;
  case "verification-graph": print(buildVerificationGraph(knowledge)); break;
  case "verification-state": print(loadVerificationState()); break;
  case "change": print(researchChangeIntelligence({ changedFiles:list(args[0]), changedTopics:list(args[1]), knowledge })); break;
  case "replay": print(args[0] == null ? replayTimeline() : replayFrame(Number(args[0]))); break;
  case "build-index": {
    const index = buildSourceIndex();
    print({ generatedAt:index.generatedAt, rootPresent:index.rootPresent, files:index.files, chunks:index.chunks.length });
    break;
  }
  case "status":
  case "repository-status": print(repositoryStatusSummary({ knowledge })); break;
  case "claim-evidence-matrix": print(buildClaimEvidenceMatrix(knowledge)); break;
  case "artifact-drift": print(artifactDriftStatus()); break;
  case "render-graph": print(renderGraphV2({ knowledge })); break;
  default:
    console.error(`Usage:
  node scripts/research-intelligence.mjs summary
  node scripts/research-intelligence.mjs resolve "<task>"
  node scripts/research-intelligence.mjs orchestrate "<task>" [topic-id]
  node scripts/research-intelligence.mjs graph <topic-id> [depth]
  node scripts/research-intelligence.mjs search "<query>" [limit]
  node scripts/research-intelligence.mjs context "<task>" [audience] [topic-id]
  node scripts/research-intelligence.mjs impact "<files>" "<topics>"
  node scripts/research-intelligence.mjs verification-plan "<task>" "<topics>" "<files>"
  node scripts/research-intelligence.mjs verification-graph
  node scripts/research-intelligence.mjs verification-state
  node scripts/research-intelligence.mjs change "<files>" "<topics>"
  node scripts/research-intelligence.mjs replay [sequence]
  node scripts/research-intelligence.mjs build-index
  node scripts/research-intelligence.mjs status
  node scripts/research-intelligence.mjs repository-status
  node scripts/research-intelligence.mjs claim-evidence-matrix
  node scripts/research-intelligence.mjs artifact-drift
  node scripts/research-intelligence.mjs render-graph`);
    process.exitCode = 2;
}
