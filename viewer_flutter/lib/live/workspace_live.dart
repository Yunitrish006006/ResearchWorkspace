import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../model/graph_data.dart';

class WorkspaceLiveClient {
  WorkspaceLiveClient._(this.base, this._client);
  WorkspaceLiveClient.forTesting(this.base, this._client);
  final Uri base;
  final http.Client _client;

  static Future<WorkspaceLiveClient?> probe() async {
    for (final raw in ['http://127.0.0.1:18775', 'http://localhost:18775']) {
      final client = http.Client();
      try {
        final response = await client.get(Uri.parse(raw + '/api/health')).timeout(const Duration(milliseconds: 900));
        if (response.statusCode == 200) return WorkspaceLiveClient._(Uri.parse(raw), client);
      } catch (_) {}
      client.close();
    }
    return null;
  }

  Uri _uri(String path, [Map<String, String>? query]) =>
      base.replace(path: path, queryParameters: query);

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? query]) async {
    final response = await _client.get(_uri(path, query)).timeout(const Duration(seconds: 4));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(path + ' returned ' + response.statusCode.toString());
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final response = await _client.post(
      _uri(path),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 8));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(path + ' returned ' + response.statusCode.toString());
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }

  Future<GraphData> graphData() async =>
      GraphData.fromJson(await _get('/api/graph-data'));

  Future<RepositoryStatus> repositoryStatus() async =>
      RepositoryStatus.fromJson(await _get('/api/repository-status'));

  Future<ResearchChange> changeIntelligence() async =>
      ResearchChange.fromJson(await _get('/api/change-intelligence'));

  Future<VerificationState> verificationState() async =>
      VerificationState.fromJson(await _get('/api/verification-state'));

  Future<ArtifactDrift> artifactDrift() async =>
      ArtifactDrift.fromJson(await _get('/api/artifact-drift'));

  Future<ActivityBatch> activity({int after = 0}) async =>
      ActivityBatch.fromJson(await _get('/api/activity', {'after': after.toString(), 'limit': '50'}));

  Future<ReplayTimeline> replayTimeline() async =>
      ReplayTimeline.fromJson(await _get('/api/replay'));

  Future<ReplayFrame> replayFrame(int sequence) async =>
      ReplayFrame.fromJson(await _get('/api/replay/frame', {'sequence': sequence.toString()}));

  Future<ViewerSettings> viewerSettings() async =>
      ViewerSettings.fromJson(await _get('/api/viewer-settings'));

  Future<ViewerSettings> updateViewerSettings(ViewerSettings settings) async =>
      ViewerSettings.fromJson(await _post('/api/viewer-settings', settings.toJson()));

  Future<PromptSubmission> submitPrompt(String prompt) async =>
      PromptSubmission.fromJson(await _post('/api/prompt', {'prompt': prompt}));

  Future<ConversationSnapshot> conversation({int after = 0}) async =>
      ConversationSnapshot.fromJson(await _get('/api/conversation', {'after': after.toString()}));

  Future<void> updateConversationDraft(String clientId, String text) async {
    await _post('/api/conversation/draft', {'clientId': clientId, 'text': text});
  }

  Future<AdapterStatus> adapterStatus() async =>
      AdapterStatus.fromJson(await _get('/api/agent-adapter'));

  void close() => _client.close();
}

List<String> _strings(Object? value) =>
    (value as List? ?? const []).whereType<String>().toList(growable: false);

class RepositoryStatus {
  const RepositoryStatus({required this.dirtyCount, required this.driftCount, required this.missingCount});
  final int dirtyCount;
  final int driftCount;
  final int missingCount;
  factory RepositoryStatus.fromJson(Map<String, dynamic> json) => RepositoryStatus(
    dirtyCount: (json['dirtyCount'] as num?)?.toInt() ?? 0,
    driftCount: (json['driftCount'] as num?)?.toInt() ?? 0,
    missingCount: (json['missingCount'] as num?)?.toInt() ?? 0,
  );
}

class ResearchChange {
  const ResearchChange({required this.changedEntityIds, required this.impactedTopicIds});
  final Set<String> changedEntityIds;
  final Set<String> impactedTopicIds;
  factory ResearchChange.fromJson(Map<String, dynamic> json) => ResearchChange(
    changedEntityIds: _strings(json['changedEntityIds']).toSet(),
    impactedTopicIds: _strings(json['impactedTopicIds']).toSet(),
  );
}

class ArtifactDriftFinding {
  const ArtifactDriftFinding({required this.id, required this.message, required this.targetGroupId, required this.reason});
  final String id;
  final String message;
  final String targetGroupId;
  final String reason;
  factory ArtifactDriftFinding.fromJson(Map<String, dynamic> json) => ArtifactDriftFinding(
    id: json['id'] as String? ?? '',
    message: json['message'] as String? ?? '',
    targetGroupId: json['targetGroupId'] as String? ?? '',
    reason: json['reason'] as String? ?? '',
  );
}

class ArtifactDrift {
  const ArtifactDrift({required this.available, required this.driftCount, required this.affectedArtifactGroupIds, required this.findings});
  final bool available;
  final int driftCount;
  final Set<String> affectedArtifactGroupIds;
  final List<ArtifactDriftFinding> findings;
  factory ArtifactDrift.fromJson(Map<String, dynamic> json) => ArtifactDrift(
    available: json['available'] as bool? ?? false,
    driftCount: (json['driftCount'] as num?)?.toInt() ?? 0,
    affectedArtifactGroupIds: _strings(json['affectedArtifactGroupIds']).toSet(),
    findings: (json['findings'] as List? ?? const [])
      .whereType<Map>()
      .map((x) => ArtifactDriftFinding.fromJson(Map<String, dynamic>.from(x)))
      .toList(growable: false),
  );
}

class VerificationState {
  const VerificationState({required this.running, required this.passed, required this.failed});
  final Set<String> running;
  final Set<String> passed;
  final Set<String> failed;
  factory VerificationState.fromJson(Map<String, dynamic> json) => VerificationState(
    running: _strings(json['runningTargetIds']).toSet(),
    passed: _strings(json['passedTargetIds']).toSet(),
    failed: _strings(json['failedTargetIds']).toSet(),
  );
}

class ActivityEvent {
  const ActivityEvent({
    required this.sequence,
    required this.type,
    required this.summary,
    this.timestamp,
    this.source,
    this.topicId,
    this.claimId,
    this.planTopicId,
    this.repository,
    this.file,
    this.taskId,
    this.status,
    this.detail,
  });
  final int sequence;
  final String type;
  final String summary;
  final String? timestamp;
  final String? source;
  final String? topicId;
  final String? claimId;
  final String? planTopicId;
  final String? repository;
  final String? file;
  final String? taskId;
  final String? status;
  final String? detail;
  String? get focusId => claimId ?? topicId ?? planTopicId;

  factory ActivityEvent.fromJson(Map<String, dynamic> json) {
    final plan = json['plan'] is Map ? Map<String, dynamic>.from(json['plan'] as Map) : const <String, dynamic>{};
    final topics = _strings(plan['topics']);
    return ActivityEvent(
      sequence: (json['sequence'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'activity',
      summary: json['summary'] as String? ?? '',
      timestamp: json['timestamp'] as String? ?? json['at'] as String?,
      source: json['source'] as String?,
      topicId: json['topicId'] as String?,
      claimId: json['claimId'] as String?,
      planTopicId: topics.isEmpty ? null : topics.first,
      repository: json['repository'] as String?,
      file: json['file'] as String?,
      taskId: json['taskId'] as String?,
      status: json['status'] as String?,
      detail: json['detail'] as String?,
    );
  }
}

class ActivityBatch {
  const ActivityBatch(this.events);
  final List<ActivityEvent> events;
  factory ActivityBatch.fromJson(Map<String, dynamic> json) => ActivityBatch(
    (json['events'] as List? ?? const [])
      .whereType<Map>()
      .map((x) => ActivityEvent.fromJson(Map<String, dynamic>.from(x)))
      .toList(growable: false),
  );
}

class ReplayTimeline {
  const ReplayTimeline({required this.earliest, required this.latest, required this.eventCount, required this.checkpointCount});
  final int earliest;
  final int latest;
  final int eventCount;
  final int checkpointCount;
  bool get hasEvents => eventCount > 0;

  factory ReplayTimeline.fromJson(Map<String, dynamic> json) => ReplayTimeline(
    earliest: (json['earliestSequence'] as num?)?.toInt() ?? 0,
    latest: (json['latestSequence'] as num?)?.toInt() ?? 0,
    eventCount: (json['eventCount'] as num?)?.toInt() ?? 0,
    checkpointCount: (json['checkpointCount'] as num?)?.toInt() ?? 0,
  );
}

class ReplayFrame {
  const ReplayFrame({required this.sequence, required this.live, required this.historicalEntityIds});
  final int sequence;
  final bool live;
  final Set<String> historicalEntityIds;

  factory ReplayFrame.fromJson(Map<String, dynamic> json) {
    final checkpoint = json['checkpoint'] is Map ? Map<String, dynamic>.from(json['checkpoint'] as Map) : const <String, dynamic>{};
    return ReplayFrame(
      sequence: (json['sequence'] as num?)?.toInt() ?? 0,
      live: json['live'] as bool? ?? false,
      historicalEntityIds: _strings(checkpoint['historicalEntityIds']).toSet(),
    );
  }
}

class ViewerSettings {
  const ViewerSettings({required this.promptEnabled, required this.agentActivityEnabled, required this.replayEnabled, required this.changeAnimationsEnabled});
  final bool promptEnabled;
  final bool agentActivityEnabled;
  final bool replayEnabled;
  final bool changeAnimationsEnabled;

  factory ViewerSettings.fromJson(Map<String, dynamic> json) => ViewerSettings(
    promptEnabled: json['promptEnabled'] as bool? ?? false,
    agentActivityEnabled: json['agentActivityEnabled'] as bool? ?? true,
    replayEnabled: json['replayEnabled'] as bool? ?? true,
    changeAnimationsEnabled: json['changeAnimationsEnabled'] as bool? ?? true,
  );

  Map<String, dynamic> toJson() => {
    'promptEnabled': promptEnabled,
    'agentActivityEnabled': agentActivityEnabled,
    'replayEnabled': replayEnabled,
    'changeAnimationsEnabled': changeAnimationsEnabled,
  };

  ViewerSettings copyWith({bool? promptEnabled}) => ViewerSettings(
    promptEnabled: promptEnabled ?? this.promptEnabled,
    agentActivityEnabled: agentActivityEnabled,
    replayEnabled: replayEnabled,
    changeAnimationsEnabled: changeAnimationsEnabled,
  );
}

class AdapterStatus {
  const AdapterStatus({required this.enabled, required this.execution});
  final bool enabled;
  final String execution;
  factory AdapterStatus.fromJson(Map<String, dynamic> json) => AdapterStatus(
    enabled: json['enabled'] as bool? ?? false,
    execution: json['execution'] as String? ?? 'prompt-intake-only',
  );
}

class PromptSubmission {
  const PromptSubmission({required this.mode, required this.score, required this.event, required this.execution});
  final String mode;
  final int score;
  final ActivityEvent event;
  final String execution;

  factory PromptSubmission.fromJson(Map<String, dynamic> json) {
    final orchestration = Map<String, dynamic>.from(json['orchestration'] as Map? ?? const {});
    return PromptSubmission(
      mode: orchestration['mode'] as String? ?? 'primary-only',
      score: (orchestration['score'] as num?)?.toInt() ?? 0,
      event: ActivityEvent.fromJson(Map<String, dynamic>.from(json['event'] as Map? ?? const {})),
      execution: json['execution'] as String? ?? 'unknown',
    );
  }
}

class ConversationEntry {
  const ConversationEntry({
    required this.revision,
    required this.source,
    required this.kind,
    required this.text,
    this.timestamp,
    this.taskId,
    this.status,
    this.conversationId,
  });
  final int revision;
  final String source;
  final String kind;
  final String text;
  final String? timestamp;
  final String? taskId;
  final String? status;
  final String? conversationId;

  factory ConversationEntry.fromJson(Map<String, dynamic> json) => ConversationEntry(
    revision: (json['revision'] as num?)?.toInt() ?? 0,
    source: json['source'] as String? ?? 'workspace',
    kind: json['kind'] as String? ?? 'status',
    text: json['text'] as String? ?? '',
    timestamp: json['timestamp'] as String?,
    taskId: json['taskId'] as String?,
    status: json['status'] as String?,
    conversationId: json['conversationId'] as String?,
  );
}

class ConversationDraft {
  const ConversationDraft({required this.revision, required this.clientId, required this.text, this.timestamp});
  final int revision;
  final String clientId;
  final String text;
  final String? timestamp;

  factory ConversationDraft.fromJson(Map<String, dynamic> json) => ConversationDraft(
    revision: (json['revision'] as num?)?.toInt() ?? 0,
    clientId: json['clientId'] as String? ?? '',
    text: json['text'] as String? ?? '',
    timestamp: json['timestamp'] as String?,
  );
}

class ConversationSnapshot {
  const ConversationSnapshot({required this.latestRevision, required this.entries, this.draft});
  final int latestRevision;
  final List<ConversationEntry> entries;
  final ConversationDraft? draft;

  factory ConversationSnapshot.fromJson(Map<String, dynamic> json) {
    final rawDraft = json['draft'];
    return ConversationSnapshot(
      latestRevision: (json['latestRevision'] as num?)?.toInt() ?? 0,
      entries: (json['entries'] as List? ?? const [])
        .whereType<Map>()
        .map((x) => ConversationEntry.fromJson(Map<String, dynamic>.from(x)))
        .toList(growable: false),
      draft: rawDraft is Map ? ConversationDraft.fromJson(Map<String, dynamic>.from(rawDraft)) : null,
    );
  }
}
