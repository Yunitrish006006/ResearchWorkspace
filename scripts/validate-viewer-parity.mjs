import assert from "node:assert/strict";
import fs from "node:fs";

const flutter=fs.readFileSync(new URL("../viewer_flutter/lib/widgets/graph_view.dart",import.meta.url),"utf8");
const flutterLive=fs.readFileSync(new URL("../viewer_flutter/lib/live/workspace_live.dart",import.meta.url),"utf8");
const legacy=fs.readFileSync(new URL("../site/local-live.js",import.meta.url),"utf8");
const legacyGraph=fs.readFileSync(new URL("../site/research-graph-v2.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../site/index.html",import.meta.url),"utf8");

const endpoints=[
  "/api/repository-status","/api/change-intelligence","/api/verification-state",
  "/api/artifact-drift","/api/activity","/api/replay","/api/viewer-settings","/api/agent-adapter"
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
for(const relation of ["contains","supports","uses-method","grounded-in","validated-by","limits"]){
  assert.ok(flutter.includes("'"+relation+"'"),"Flutter relation missing "+relation);
  assert.ok(legacyGraph.includes('"'+relation+'"')||html.includes('data-edge-filter="'+relation+'"'),"Legacy relation missing "+relation);
}
for(const lod of ["topic","claim","study","evidence","review"]){
  assert.ok(flutter.includes("'"+lod+"'"),"Flutter LOD missing "+lod);
  assert.ok(legacyGraph.includes('"'+lod+'"'),"Legacy LOD missing "+lod);
}
console.log("Flutter and legacy live/overlay/semantic parity OK");
