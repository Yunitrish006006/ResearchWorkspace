import assert from "node:assert/strict";
import fs from "node:fs";

const flutter=fs.readFileSync(new URL("../viewer_flutter/lib/widgets/graph_view.dart",import.meta.url),"utf8");
const flutterLive=fs.readFileSync(new URL("../viewer_flutter/lib/live/workspace_live.dart",import.meta.url),"utf8");
const flutterData=fs.readFileSync(new URL("../viewer_flutter/lib/model/graph_data.dart",import.meta.url),"utf8");
const flutterScene=fs.readFileSync(new URL("../viewer_flutter/lib/model/graph_scene.dart",import.meta.url),"utf8");
const legacy=fs.readFileSync(new URL("../site/local-live.js",import.meta.url),"utf8");
const legacyGraph=fs.readFileSync(new URL("../site/research-graph-v2.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../site/index.html",import.meta.url),"utf8");

const endpoints=[
  "/api/repository-status","/api/change-intelligence","/api/verification-state",
  "/api/artifact-drift","/api/activity","/api/replay","/api/viewer-settings","/api/agent-adapter",
  "/api/conversation","/api/conversation/draft"
];
for(const endpoint of endpoints){
  assert.ok(flutterLive.includes(endpoint),"Flutter live client missing "+endpoint);
  assert.ok(legacy.includes(endpoint),"Legacy live client missing "+endpoint);
}
for(const semantic of ["changedEntityIds","impactedTopicIds","runningVerification","passedVerification","failedVerification","activityNodeId","historicalEntityIds"]){
  assert.ok(flutter.includes(semantic),"Flutter overlay missing "+semantic);
  assert.ok(legacyGraph.includes(semantic),"Legacy overlay missing "+semantic);
}
assert.ok(flutter.includes("ArtifactDrift"));
assert.ok(legacy.includes("artifact.driftCount"));
assert.ok(html.includes('id="artifactDrift"'));
assert.ok(html.includes('id="conversationPanel"'));
assert.ok(html.includes('id="conversationToggle"'));
assert.ok(flutter.includes("Research Conversation"));
assert.ok(legacy.includes("pollConversation"));
assert.ok(legacy.includes("syncDraft"));

for(const relation of ["contains","supports","uses-method","grounded-in","validated-by","limits"]){
  assert.ok(flutter.includes("'"+relation+"'")||flutterScene.includes("'"+relation+"'"),"Flutter relation missing "+relation);
  assert.ok(legacyGraph.includes('"'+relation+'"')||html.includes('data-edge-filter="'+relation+'"'),"Legacy relation missing "+relation);
}
for(const lod of ["topic","claim","study","evidence","review","source-area","artifact"]){
  assert.ok(flutter.includes("'"+lod+"'")||flutterScene.includes("'"+lod+"'"),"Flutter LOD missing "+lod);
  assert.ok(legacyGraph.includes('"'+lod+'"'),"Legacy LOD missing "+lod);
}

for(const token of ["sourceAreas","artifacts","GraphSourceArea","GraphArtifact"]){
  assert.ok(flutterData.includes(token),"Flutter graph model missing "+token);
}
assert.ok(flutterScene.includes("data.sourceAreas"));
assert.ok(flutterScene.includes("data.artifacts"));
assert.ok(flutterScene.includes("expanded.contains(area.id)"));
assert.ok(legacyGraph.includes("sourceAreas"));
assert.ok(legacyGraph.includes("artifacts"));
assert.ok(legacyGraph.includes("expanded.has(area.id)"));

console.log("Flutter and legacy live/overlay/semantic/L4 source parity OK");
