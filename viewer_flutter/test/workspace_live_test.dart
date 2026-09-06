import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:research_workspace_viewer/live/workspace_live.dart';

void main() {
  test('live client parses shared graph model and local research surfaces', () async {
    final mock = MockClient((request) async {
      switch (request.url.path) {
        case '/api/graph-data':
          return http.Response(jsonEncode({
            'snapshot': {'date':'2026-09-06'},
            'root': {'id':'thesis','name':'Thesis','summary':''},
            'topics': [{'id':'scope','name':'Scope','summary':'','rankHint':1}],
            'claims': [],
            'studies': [],
            'evidence': [],
            'reviews': [],
            'sourceAreas': [],
            'artifacts': [],
            'relations': []
          }),200);
        case '/api/repository-status':
          return http.Response(jsonEncode({'dirtyCount':1,'driftCount':2,'missingCount':0}),200);
        case '/api/change-intelligence':
          return http.Response(jsonEncode({'changedEntityIds':['scope'],'impactedTopicIds':['scope']}),200);
        case '/api/verification-state':
          return http.Response(jsonEncode({'runningTargetIds':[],'passedTargetIds':['review-e1'],'failedTargetIds':[]}),200);
        case '/api/artifact-drift':
          return http.Response(jsonEncode({'available':true,'driftCount':1,'affectedArtifactGroupIds':['presentation'],'findings':[{'id':'x','message':'drift','targetGroupId':'presentation','reason':'newer-source-commit'}]}),200);
        case '/api/activity':
          return http.Response(jsonEncode({'events':[{'sequence':3,'type':'file_edit','summary':'changed','topicId':'scope'}]}),200);
        case '/api/replay':
          return http.Response(jsonEncode({'earliestSequence':1,'latestSequence':3,'eventCount':3,'checkpointCount':1}),200);
        case '/api/replay/frame':
          return http.Response(jsonEncode({'sequence':2,'live':false,'checkpoint':{'historicalEntityIds':['thesis','scope']}}),200);
        case '/api/viewer-settings':
          return http.Response(jsonEncode({'promptEnabled':false,'agentActivityEnabled':true,'replayEnabled':true,'changeAnimationsEnabled':true}),200);
        case '/api/agent-adapter':
          return http.Response(jsonEncode({'enabled':true,'execution':'opt-in-ready'}),200);
        case '/api/prompt':
          return http.Response(jsonEncode({'execution':'codex','event':{'sequence':4,'type':'prompt_submitted','summary':'prompt'},'orchestration':{'mode':'assisted','score':4}}),202);
        case '/api/conversation':
          return http.Response(jsonEncode({'latestRevision':3,'draft':{'revision':2,'clientId':'discord','text':'draft'},'entries':[{'revision':3,'source':'discord','kind':'prompt','text':'sync me'}]}),200);
        case '/api/conversation/draft':
          return http.Response(jsonEncode({'status':'accepted'}),202);
      }
      return http.Response('not found',404);
    });

    final client = WorkspaceLiveClient.forTesting(Uri.parse('http://127.0.0.1:18775'), mock);
    expect((await client.graphData()).topics.single.id,'scope');
    expect((await client.repositoryStatus()).driftCount,2);
    expect((await client.changeIntelligence()).changedEntityIds,contains('scope'));
    expect((await client.verificationState()).passed,contains('review-e1'));
    expect((await client.artifactDrift()).driftCount,1);
    expect((await client.activity()).events.single.focusId,'scope');
    expect((await client.replayTimeline()).eventCount,3);
    expect((await client.replayFrame(2)).historicalEntityIds,contains('scope'));
    expect((await client.viewerSettings()).replayEnabled,isTrue);
    expect((await client.adapterStatus()).enabled,isTrue);
    expect((await client.submitPrompt('test')).mode,'assisted');
    final conversation=await client.conversation(after:0);
    expect(conversation.latestRevision,3);
    expect(conversation.entries.single.source,'discord');
    expect(conversation.draft!.text,'draft');
    await client.updateConversationDraft('viewer:test','draft text');
    client.close();
  });
}
