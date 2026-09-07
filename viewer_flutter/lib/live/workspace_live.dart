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

  Future<PromptSubmission> submitPrompt(String prompt, {String? clientId}) async =>
      PromptSubmission.fromJson(await _post('/api/prompt', {
        'prompt': prompt,
        if (clientId != null) 'clientId': clientId,
      }));

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

  factory VerificationState.fromReplayJson(Map<String, dynamic> json) {
    final running = <String>{};
    final passed = <String>{};
    final failed = <String>{};
    for (final raw in (json['entries'] as List? ?? const [])) {
      if (raw is! Map) continue;
      final entry = Map<String, dynamic>.from(raw);
      final id = entry['targetId'] as String? ?? entry['target'] as String?;
      if (id == null || id.isEmpty) continue;
      switch (entry['status']) {
        case 'running': running.add(id); break;
        case 'passed': passed.add(id); break;
        case 'failed': failed.add(id); break;
      }
    }
    return VerificationState(running: running, passed: passed, failed: failed);
  }
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
    this.symbol,
    this.sourceAreaId,
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
  final String? symbol;
  final String? sourceAreaId;
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
      symbol: json['symbol'] as String?,
      sourceAreaId: json['sourceAreaId'] as String?,
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

class ReplayMilestone {
  const ReplayMilestone({
    required this.sequence,
    required this.type,
    this.timestamp,
    this.taskId,
    this.sessionId,
    this.topicId,
    this.summary,
  });
  final int sequence;
  final String type;
  final String? timestamp;
  final String? taskId;
  final String? sessionId;
  final String? topicId;
  final String? summary;

  factory ReplayMilestone.fromJson(Map<String, dynamic> json) => ReplayMilestone(
    sequence: (json['sequence'] as num?)?.toInt() ?? 0,
    type: json['type'] as String? ?? 'unknown',
    timestamp: json['timestamp'] as String?,
    taskId: json['taskId'] as String?,
    sessionId: json['sessionId'] as String?,
    topicId: json['topicId'] as String?,
    summary: json['summary'] as String?,
  );
}

class ReplaySession {
  const ReplaySession({
    required this.id,
    required this.state,
    required this.startedSequence,
    required this.eventCount,
    required this.milestoneCount,
    required this.milestones,
    this.taskId,
    this.endedSequence,
    this.startedAt,
    this.endedAt,
    this.topicId,
    this.claimId,
    this.summary,
  });
  final String id;
  final String state;
  final String? taskId;
  final int startedSequence;
  final int? endedSequence;
  final String? startedAt;
  final String? endedAt;
  final String? topicId;
  final String? claimId;
  final String? summary;
  final int eventCount;
  final int milestoneCount;
  final List<ReplayMilestone> milestones;

  factory ReplaySession.fromJson(Map<String, dynamic> json) => ReplaySession(
    id: json['id'] as String? ?? '',
    state: json['state'] as String? ?? 'unknown',
    taskId: json['taskId'] as String?,
    startedSequence: (json['startedSequence'] as num?)?.toInt() ?? 0,
    endedSequence: (json['endedSequence'] as num?)?.toInt(),
    startedAt: json['startedAt'] as String?,
    endedAt: json['endedAt'] as String?,
    topicId: json['topicId'] as String?,
    claimId: json['claimId'] as String?,
    summary: json['summary'] as String?,
    eventCount: (json['eventCount'] as num?)?.toInt() ?? 0,
    milestoneCount: (json['milestoneCount'] as num?)?.toInt() ?? 0,
    milestones: (json['milestones'] as List? ?? const [])
      .whereType<Map>()
      .map((x) => ReplayMilestone.fromJson(Map<String, dynamic>.from(x)))
      .toList(growable: false),
  );
}

class ReplayTimeline {
  const ReplayTimeline({
    required this.earliest,
    required this.latest,
    required this.eventCount,
    required this.checkpointCount,
    required this.sessions,
    required this.milestones,
  });
  final int earliest;
  final int latest;
  final int eventCount;
  final int checkpointCount;
  final List<ReplaySession> sessions;
  final List<ReplayMilestone> milestones;
  bool get hasEvents => eventCount > 0 && latest >= earliest;

  factory ReplayTimeline.fromJson(Map<String, dynamic> json) => ReplayTimeline(
    earliest: (json['earliestSequence'] as num?)?.toInt() ?? 0,
    latest: (json['latestSequence'] as num?)?.toInt() ?? 0,
    eventCount: (json['eventCount'] as num?)?.toInt() ?? 0,
    checkpointCount: (json['checkpointCount'] as num?)?.toInt() ?? 0,
    sessions: (json['sessions'] as List? ?? const [])
      .whereType<Map>()
      .map((x) => ReplaySession.fromJson(Map<String, dynamic>.from(x)))
      .toList(growable: false),
    milestones: (json['milestones'] as List? ?? const [])
      .whereType<Map>()
      .map((x) => ReplayMilestone.fromJson(Map<String, dynamic>.from(x)))
      .toList(growable: false),
  );
}

class ReplayFrame {
  const ReplayFrame({
    required this.sequence,
    required this.live,
    required this.historicalEntityIds,
    this.activity,
    this.changeIntelligence,
    this.verification,
  });
  final int sequence;
  final bool live;
  final Set<String> historicalEntityIds;
  final ActivityEvent? activity;
  final ResearchChange? changeIntelligence;
  final VerificationState? verification;

  factory ReplayFrame.fromJson(Map<String, dynamic> json) {
    final checkpoint = json['checkpoint'] is Map
        ? Map<String, dynamic>.from(json['checkpoint'] as Map)
        : const <String, dynamic>{};
    final rawActivity = json['activity'];
    final rawChange = json['changeIntelligence'];
    final rawVerification = json['verification'];
    return ReplayFrame(
      sequence: (json['sequence'] as num?)?.toInt() ?? 0,
      live: json['live'] as bool? ?? false,
      historicalEntityIds: _strings(checkpoint['historicalEntityIds']).toSet(),
      activity: rawActivity is Map
          ? ActivityEvent.fromJson(Map<String, dynamic>.from(rawActivity))
          : null,
      changeIntelligence: rawChange is Map
          ? ResearchChange.fromJson(Map<String, dynamic>.from(rawChange))
          : null,
      verification: rawVerification is Map
          ? VerificationState.fromReplayJson(
              Map<String, dynamic>.from(rawVerification))
          : null,
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

class OrchestrationAssignment {
  const OrchestrationAssignment({
    required this.role,
    required this.scope,
    required this.access,
    required this.wave,
  });
  final String role;
  final List<String> scope;
  final String access;
  final String wave;

  factory OrchestrationAssignment.fromJson(Map<String, dynamic> json) =>
      OrchestrationAssignment(
        role: json['role'] as String? ?? 'unknown',
        scope: _strings(json['scope']),
        access: json['access'] as String? ?? 'read-only',
        wave: json['wave'] as String? ?? 'unknown',
      );
}

class OrchestrationSummary {
  const OrchestrationSummary({
    required this.mode,
    required this.score,
    required this.topics,
    required this.claims,
    required this.assignments,
    required this.maxSubagents,
    required this.maxParallelEvidenceExtractors,
  });
  final String mode;
  final int score;
  final List<String> topics;
  final List<String> claims;
  final List<OrchestrationAssignment> assignments;
  final int maxSubagents;
  final int maxParallelEvidenceExtractors;

  factory OrchestrationSummary.fromJson(Map<String, dynamic> json) {
    final constraints = Map<String, dynamic>.from(
      json['constraints'] as Map? ?? const <String, dynamic>{},
    );
    return OrchestrationSummary(
      mode: json['mode'] as String? ?? 'primary-only',
      score: (json['score'] as num?)?.toInt() ?? 0,
      topics: _strings(json['topics']),
      claims: _strings(json['claims']),
      assignments: (json['assignments'] as List? ?? const [])
        .whereType<Map>()
        .map((x) => OrchestrationAssignment.fromJson(Map<String, dynamic>.from(x)))
        .toList(growable: false),
      maxSubagents: (constraints['maxSubagents'] as num?)?.toInt() ?? 4,
      maxParallelEvidenceExtractors:
          (constraints['maxParallelEvidenceExtractors'] as num?)?.toInt() ?? 2,
    );
  }
}

class AgentTask {
  const AgentTask({
    required this.id,
    required this.state,
    required this.adapter,
    this.topicId,
    this.claimId,
    this.threadId,
    this.startedAt,
    this.completedAt,
    this.summary,
    this.error,
    this.finalMessage,
    this.orchestration,
  });
  final String id;
  final String state;
  final String adapter;
  final String? topicId;
  final String? claimId;
  final String? threadId;
  final String? startedAt;
  final String? completedAt;
  final String? summary;
  final String? error;
  final String? finalMessage;
  final OrchestrationSummary? orchestration;

  factory AgentTask.fromJson(Map<String, dynamic> json) {
    final rawOrchestration = json['orchestration'];
    return AgentTask(
      id: json['id'] as String? ?? '',
      state: json['state'] as String? ?? 'unknown',
      adapter: json['adapter'] as String? ?? '',
      topicId: json['topicId'] as String?,
      claimId: json['claimId'] as String?,
      threadId: json['threadId'] as String?,
      startedAt: json['startedAt'] as String?,
      completedAt: json['completedAt'] as String?,
      summary: json['summary'] as String?,
      error: json['error'] as String?,
      finalMessage: json['finalMessage'] as String?,
      orchestration: rawOrchestration is Map
          ? OrchestrationSummary.fromJson(Map<String, dynamic>.from(rawOrchestration))
          : null,
    );
  }
}

class AdapterStatus {
  const AdapterStatus({
    required this.enabled,
    required this.execution,
    required this.configured,
    required this.available,
    required this.busy,
    this.kind,
    this.version,
    this.sandbox,
    this.model,
    this.reason,
    this.currentTask,
    this.lastTask,
  });
  final bool enabled;
  final String execution;
  final bool configured;
  final bool available;
  final bool busy;
  final String? kind;
  final String? version;
  final String? sandbox;
  final String? model;
  final String? reason;
  final AgentTask? currentTask;
  final AgentTask? lastTask;

  String get label {
    if (!configured) return 'ADAPTER OFF';
    if (!available) return 'CODEX UNAVAILABLE';
    if (busy) return 'CODEX BUSY';
    return 'CODEX READY';
  }

  factory AdapterStatus.fromJson(Map<String, dynamic> json) {
    AgentTask? parseTask(String key) {
      final raw = json[key];
      return raw is Map
          ? AgentTask.fromJson(Map<String, dynamic>.from(raw))
          : null;
    }
    return AdapterStatus(
      enabled: json['enabled'] as bool? ?? false,
      execution: json['execution'] as String? ?? 'prompt-intake-only',
      configured: json['configured'] as bool? ?? false,
      available: json['available'] as bool? ?? false,
      busy: json['busy'] as bool? ?? false,
      kind: json['kind'] as String?,
      version: json['version'] as String?,
      sandbox: json['sandbox'] as String?,
      model: json['model'] as String?,
      reason: json['reason'] as String?,
      currentTask: parseTask('currentTask'),
      lastTask: parseTask('lastTask'),
    );
  }
}

class PromptSubmission {
  const PromptSubmission({
    required this.mode,
    required this.score,
    required this.event,
    required this.execution,
    this.status = 'accepted',
    this.task,
    this.adapter,
    this.orchestration,
  });
  final String mode;
  final int score;
  final ActivityEvent event;
  final String execution;
  final String status;
  final AgentTask? task;
  final AdapterStatus? adapter;
  final OrchestrationSummary? orchestration;

  factory PromptSubmission.fromJson(Map<String, dynamic> json) {
    final rawOrchestration = json['orchestration'];
    final orchestration = rawOrchestration is Map
        ? OrchestrationSummary.fromJson(
            Map<String, dynamic>.from(rawOrchestration))
        : null;
    final rawTask = json['task'];
    final rawAdapter = json['adapter'];
    return PromptSubmission(
      mode: orchestration?.mode ?? 'primary-only',
      score: orchestration?.score ?? 0,
      event: ActivityEvent.fromJson(
        Map<String, dynamic>.from(json['event'] as Map? ?? const {})),
      execution: json['execution'] as String? ?? 'unknown',
      status: json['status'] as String? ?? 'accepted',
      task: rawTask is Map
          ? AgentTask.fromJson(Map<String, dynamic>.from(rawTask))
          : null,
      adapter: rawAdapter is Map
          ? AdapterStatus.fromJson(Map<String, dynamic>.from(rawAdapter))
          : null,
      orchestration: orchestration,
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
