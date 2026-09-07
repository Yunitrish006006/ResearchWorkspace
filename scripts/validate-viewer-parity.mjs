import assert from "node:assert/strict";
import fs from "node:fs";

const flutter=fs.readFileSync(new URL("../viewer_flutter/lib/widgets/graph_view.dart",import.meta.url),"utf8");
const flutterLive=fs.readFileSync(new URL("../viewer_flutter/lib/live/workspace_live.dart",import.meta.url),"utf8");
const flutterData=fs.readFileSync(new URL("../viewer_flutter/lib/model/graph_data.dart",import.meta.url),"utf8");
const flutterScene=fs.readFileSync(new URL("../viewer_flutter/lib/model/graph_scene.dart",import.meta.url),"utf8");
const activityLocation=fs.readFileSync(new URL("../viewer_flutter/lib/widgets/activity_location.dart",import.meta.url),"utf8");
const legacy=fs.readFileSync(new URL("../site/local-live.js",import.meta.url),"utf8");
const legacyGraph=fs.readFileSync(new URL("../site/research-graph-v2.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../site/index.html",import.meta.url),"utf8");

const endpoints=[
  "/api/graph-data","/api/repository-status","/api/change-intelligence","/api/verification-state",
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
assert.ok(flutter.includes("changeAnimationsEnabled: _settings.changeAnimationsEnabled"));
assert.ok(flutter.includes("final changePulse = changeAnimationsEnabled"));
assert.ok(legacy.includes("artifact.driftCount"));
assert.ok(html.includes('id="artifactDrift"'));
assert.ok(html.includes('id="conversationPanel"'));
assert.ok(html.includes('id="conversationToggle"'));
assert.ok(flutter.includes("Research Conversation"));
assert.ok(legacy.includes("pollConversation"));
assert.ok(legacy.includes("syncDraft"));
assert.ok(legacy.includes("graphApi.replaceData"));
assert.ok(legacyGraph.includes("replaceData:replaceData"));
assert.ok(flutter.includes("_data = results[0] as GraphData"));
for(const token of ["file_edit","symbol_edit","keptOpen","onHoverChanged","onKeepOpenChanged","semanticTargets","matches"]){
  assert.ok(activityLocation.includes(token),"Activity Source Location parity missing "+token);
}
for(const token of ["_hoveredActivityLocation","_keptOpenActivityLocation","_showActivitySourceLocation","_toggleKeptOpenActivityLocation","_transientActivityExpanded","_visibleExpanded","_syncTransientActivityExpansion","_liveActivityFocus","Visible relationships","spotlightId","relatedOwners","SingleTickerProviderStateMixin","BrowserContextMenu","kSecondaryMouseButton","LogicalKeyboardKey","activityPulse"]){
  assert.ok(flutter.includes(token),"Flutter activity-location host behavior missing "+token);
}

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
for(const token of ["edgeFilterKeys","edgeFilterLabels","enabledFilters"]){
  assert.ok(flutterScene.includes(token),"Flutter relationship-filter scene contract missing "+token);
  assert.ok(flutter.includes(token),"Flutter relationship-filter UI contract missing "+token);
}
for(const token of ["_relationAwareScatter","_claimRelationHints","_relationWeight"]){
  assert.ok(flutterScene.includes(token),"Flutter relation-aware placement contract missing "+token);
}
assert.ok(legacyGraph.includes("sourceAreas"));
assert.ok(legacyGraph.includes("artifacts"));
assert.ok(legacyGraph.includes("expanded.has(area.id)"));

console.log("Flutter and legacy live/overlay/semantic/L4 source parity OK");
