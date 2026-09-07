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
          return http.Response(jsonEncode({'events':[{'sequence':3,'type':'symbol_edit','summary':'changed','topicId':'scope','repository':'Three-Factor-Digital-Twin','file':'digital_twin/model.py','symbol':'Estimator.fit','sourceAreaId':'source-area:model'}]}),200);
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
    final activity=(await client.activity()).events.single;
    expect(activity.focusId,'scope');
    expect(activity.symbol,'Estimator.fit');
    expect(activity.sourceAreaId,'source-area:model');
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

  test('adapter orchestration and replay sessions retain Totem-style live detail', () {
    final adapter = AdapterStatus.fromJson({
      'configured': true,
      'available': true,
      'enabled': true,
      'busy': true,
      'execution': 'opt-in-ready',
      'sandbox': 'workspace-write',
      'currentTask': {
        'id': 'task:1',
        'adapter': 'codex',
        'state': 'running',
        'topicId': 'governance',
        'orchestration': {
          'mode': 'guarded-parallel',
          'score': 12,
          'topics': ['governance', 'method'],
          'claims': ['claim-sync'],
          'assignments': [
            {'role': 'methodology-analyst', 'scope': ['method'], 'access': 'read-only', 'wave': 'discovery'},
            {'role': 'evidence-extractor', 'scope': ['governance'], 'access': 'write-one-topic', 'wave': 'extraction'},
          ],
          'constraints': {'maxSubagents': 4, 'maxParallelEvidenceExtractors': 2},
        },
      },
    });
    expect(adapter.busy, isTrue);
    expect(adapter.label, 'CODEX BUSY');
    expect(adapter.currentTask?.orchestration?.mode, 'guarded-parallel');
    expect(adapter.currentTask?.orchestration?.assignments.length, 2);
    expect(adapter.currentTask?.orchestration?.maxSubagents, 4);

    final replay = ReplayTimeline.fromJson({
      'earliestSequence': 1,
      'latestSequence': 9,
      'eventCount': 9,
      'checkpointCount': 2,
      'sessions': [
        {
          'id': 'session:task:1',
          'taskId': 'task:1',
          'state': 'completed',
          'startedSequence': 1,
          'endedSequence': 9,
          'eventCount': 9,
          'milestoneCount': 2,
          'milestones': [
            {'sequence': 1, 'type': 'task_started', 'topicId': 'governance'},
            {'sequence': 9, 'type': 'task_completed', 'topicId': 'governance'},
          ],
        },
      ],
      'milestones': [
        {'sequence': 1, 'type': 'task_started', 'taskId': 'task:1'},
        {'sequence': 9, 'type': 'task_completed', 'taskId': 'task:1'},
      ],
    });
    expect(replay.sessions.length, 1);
    expect(replay.sessions.single.state, 'completed');
    expect(replay.milestones.length, 2);
    expect(replay.checkpointCount, 2);
  });

}
