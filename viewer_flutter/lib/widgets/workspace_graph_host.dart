import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../live/workspace_live.dart';
import '../model/graph_data.dart';
import 'activity_location.dart';
import 'collapsible_message.dart';
import 'floating_panel.dart';
import 'graph_view.dart';

class WorkspaceGraphHost extends StatefulWidget {
  const WorkspaceGraphHost({super.key, required this.initialData});
  final GraphData initialData;

  @override
  State<WorkspaceGraphHost> createState() => _WorkspaceGraphHostState();
}

class _WorkspaceGraphHostState extends State<WorkspaceGraphHost> {
  late GraphData _data;
  WorkspaceLiveClient? _client;
  Timer? _statusPoller;
  Timer? _conversationPoller;
  Timer? _draftDebounce;
  RepositoryStatus? _repoStatus;
  ResearchChange? _change;
  VerificationState? _verification;
  ArtifactDrift? _artifactDrift;
  AdapterStatus? _adapter;
  OrchestrationSummary? _orchestration;
  ViewerSettings _settings = const ViewerSettings(
    promptEnabled: false,
    agentActivityEnabled: true,
    replayEnabled: true,
    changeAnimationsEnabled: true,
  );
  final List<ActivityEvent> _activity = <ActivityEvent>[];
  int _activitySequence = 0;
  final List<ConversationEntry> _conversation = <ConversationEntry>[];
  int _conversationRevision = 0;
  ConversationDraft? _conversationDraft;
  final String _conversationClientId =
      'viewer:' + DateTime.now().microsecondsSinceEpoch.toString();
  ReplayTimeline? _timeline;
  ReplayFrame? _replayFrame;
  bool _probing = true;
  bool _submitting = false;
  String? _liveError;
  final TextEditingController _promptController = TextEditingController();
  FloatingPanelDock _workspaceDock = FloatingPanelDock.topCenter;
  FloatingPanelDock _activityDock = FloatingPanelDock.centerRight;
  FloatingPanelDock _conversationDock = FloatingPanelDock.centerLeft;
  FloatingPanelDock _promptDock = FloatingPanelDock.bottomLeft;
  bool _workspaceCollapsed = false;
  bool _activityCollapsed = true;
  bool _conversationCollapsed = true;
  bool _promptCollapsed = false;
  ActivitySourceLocation? _hoveredActivityLocation;
  ActivitySourceLocation? _keptOpenActivityLocation;
  String? _requestedFocusId;

  bool get _conversationAvailable {
    final host = Uri.base.host.toLowerCase();
    return host == '127.0.0.1' || host == 'localhost' || host == '::1';
  }

  ActivityEvent? get _latestActivity =>
      _activity.isEmpty ? null : _activity.last;

  String? get _liveActivityFocus =>
      (_keptOpenActivityLocation ?? _hoveredActivityLocation)?.semanticTarget ??
      _latestActivity?.focusId;

  ResearchChange? get _displayedChange =>
      _replayFrame?.changeIntelligence ?? _change;

  VerificationState? get _displayedVerification =>
      _replayFrame?.verification ?? _verification;

  ActivityEvent? get _displayedActivity =>
      _replayFrame?.activity ?? _latestActivity;

  @override
  void initState() {
    super.initState();
    _data = widget.initialData;
    unawaited(_connectLocal());
  }

  @override
  void dispose() {
    _statusPoller?.cancel();
    _conversationPoller?.cancel();
    _draftDebounce?.cancel();
    _client?.close();
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _connectLocal() async {
    final client = await WorkspaceLiveClient.probe();
    if (!mounted) {
      client?.close();
      return;
    }
    setState(() {
      _client = client;
      _probing = false;
    });
    if (client == null) return;
    await _poll();
    _statusPoller =
        Timer.periodic(const Duration(milliseconds: 2200), (_) => _poll());
    if (_conversationAvailable) {
      await _pollConversation();
      _conversationPoller = Timer.periodic(
        const Duration(milliseconds: 1200),
        (_) => _pollConversation(),
      );
    }
  }

  void _mergeActivity(ActivityBatch batch) {
    if (batch.events.isEmpty) return;
    final known = _activity.map((event) => event.sequence).toSet();
    for (final event in batch.events) {
      if (!known.contains(event.sequence)) _activity.add(event);
    }
    _activity.sort((a, b) => a.sequence.compareTo(b.sequence));
    if (_activity.length > 80) {
      _activity.removeRange(0, _activity.length - 80);
    }
    _activitySequence = math.max(_activitySequence, _activity.last.sequence);
  }

  Future<void> _poll() async {
    final client = _client;
    if (client == null) return;
    try {
      final results = await Future.wait<Object>([
        client.graphData(),
        client.repositoryStatus(),
        client.changeIntelligence(),
        client.verificationState(),
        client.artifactDrift(),
        client.activity(after: _activitySequence),
        client.replayTimeline(),
        client.viewerSettings(),
        client.adapterStatus(),
      ]);
      if (!mounted) return;
      setState(() {
        _data = results[0] as GraphData;
        _repoStatus = results[1] as RepositoryStatus;
        _change = results[2] as ResearchChange;
        _verification = results[3] as VerificationState;
        _artifactDrift = results[4] as ArtifactDrift;
        _mergeActivity(results[5] as ActivityBatch);
        _timeline = results[6] as ReplayTimeline;
        _settings = results[7] as ViewerSettings;
        _adapter = results[8] as AdapterStatus;
        _orchestration =
            _adapter?.currentTask?.orchestration ??
            _adapter?.lastTask?.orchestration ??
            _orchestration;
        _liveError = null;
      });
    } catch (error) {
      if (mounted) setState(() => _liveError = error.toString());
    }
  }

  Future<void> _pollConversation() async {
    final client = _client;
    if (client == null || !_conversationAvailable) return;
    try {
      final snapshot = await client.conversation(after: _conversationRevision);
      if (!mounted) return;
      setState(() {
        final known = _conversation.map((entry) => entry.revision).toSet();
        for (final entry in snapshot.entries) {
          if (!known.contains(entry.revision)) _conversation.add(entry);
        }
        _conversation.sort((a, b) => a.revision.compareTo(b.revision));
        if (_conversation.length > 120) {
          _conversation.removeRange(0, _conversation.length - 120);
        }
        _conversationRevision = snapshot.latestRevision;
        _conversationDraft = snapshot.draft;
      });
    } catch (_) {
      // Conversation sync is loopback/private and never blocks graph polling.
    }
  }

  void _scheduleDraftSync(String text) {
    final client = _client;
    if (client == null || !_conversationAvailable) return;
    _draftDebounce?.cancel();
    _draftDebounce = Timer(const Duration(milliseconds: 450), () async {
      try {
        await client.updateConversationDraft(_conversationClientId, text);
      } catch (_) {}
    });
  }

  Future<void> _togglePrompt() async {
    final client = _client;
    if (client == null) return;
    try {
      final next = await client.updateViewerSettings(
        _settings.copyWith(promptEnabled: !_settings.promptEnabled),
      );
      if (mounted) setState(() => _settings = next);
    } catch (error) {
      if (mounted) setState(() => _liveError = error.toString());
    }
  }

  Future<void> _submitPrompt() async {
    final client = _client;
    final prompt = _promptController.text.trim();
    if (client == null ||
        prompt.isEmpty ||
        _submitting ||
        !_settings.promptEnabled) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final result = await client.submitPrompt(
        prompt,
        clientId: _conversationClientId,
      );
      if (!mounted) return;
      setState(() {
        if (!_activity.any((event) => event.sequence == result.event.sequence)) {
          _activity.add(result.event);
          _activitySequence = math.max(_activitySequence, result.event.sequence);
        }
        _promptController.clear();
        _conversationDraft = null;
        _adapter = result.adapter ?? _adapter;
        _orchestration = result.orchestration ?? result.task?.orchestration ?? _orchestration;
        _liveError = null;
      });
      await _poll();
    } catch (error) {
      if (mounted) setState(() => _liveError = error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _selectReplay(int sequence) async {
    final client = _client;
    final timeline = _timeline;
    if (client == null || timeline == null) return;
    if (sequence >= timeline.latest) {
      setState(() => _replayFrame = null);
      return;
    }
    try {
      final frame = await client.replayFrame(sequence);
      if (mounted) setState(() => _replayFrame = frame);
    } catch (error) {
      if (mounted) setState(() => _liveError = error.toString());
    }
  }

  void _setHoveredActivityLocation(
      ActivitySourceLocation location, bool hovering) {
    final same = location.matches(_hoveredActivityLocation);
    if (hovering) {
      if (!same) setState(() => _hoveredActivityLocation = location);
    } else if (same) {
      setState(() => _hoveredActivityLocation = null);
    }
  }

  void _toggleKeptOpenActivityLocation(ActivitySourceLocation location) {
    setState(() {
      _keptOpenActivityLocation = location.matches(_keptOpenActivityLocation)
          ? null
          : location;
    });
  }

  void _showActivitySourceLocation(
      ActivitySourceLocation location, Rect anchor) {
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject();
    if (overlay is! RenderBox) return;
    showMenu<void>(
      context: context,
      position: RelativeRect.fromRect(anchor, Offset.zero & overlay.size),
      color: const Color(0xFF0A1826),
      elevation: 16,
      constraints: const BoxConstraints(maxWidth: 460),
      items: [
        PopupMenuItem<void>(
          enabled: false,
          padding: EdgeInsets.zero,
          child: _ActivitySourceLocationPopover(location: location),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final local = _client != null;
    final displayedChange = _displayedChange;
    final displayedVerification = _displayedVerification;
    final displayedActivity = _displayedActivity;
    final mediaWidth = MediaQuery.sizeOf(context).width;
    final history = _replayFrame?.historicalEntityIds ?? const <String>{};

    return Stack(
      children: [
        Positioned.fill(
          child: GraphView(
            data: _data,
            activityNodeId: _liveActivityFocus,
            focusNodeId: _requestedFocusId,
            autoExpandAgentFocus: true,
            changedEntityIds:
                displayedChange?.changedEntityIds ?? const <String>{},
            impactedTopicIds:
                displayedChange?.impactedTopicIds ?? const <String>{},
            changeAnimationsEnabled: _settings.changeAnimationsEnabled,
            runningVerificationTargetIds:
                displayedVerification?.running ?? const <String>{},
            passedVerificationTargetIds:
                displayedVerification?.passed ?? const <String>{},
            failedVerificationTargetIds:
                displayedVerification?.failed ?? const <String>{},
            historicalEntityIds: history,
          ),
        ),
        if (local)
          FloatingPanel(
            title: 'Research Workspace',
            icon: Icons.hub_outlined,
            dock: _workspaceDock,
            collapsed: _workspaceCollapsed,
            width: math.min(520, mediaWidth - 24),
            onCollapsedChanged: (value) =>
                setState(() => _workspaceCollapsed = value),
            onDockChanged: (value) =>
                setState(() => _workspaceDock = value),
            child: _WorkspaceStatusPanel(
              probing: _probing,
              repo: _repoStatus,
              change: displayedChange,
              verification: displayedVerification,
              artifactDrift: _artifactDrift,
              activity: displayedActivity,
              adapter: _adapter,
              orchestration: _orchestration,
              replay: _timeline,
              promptEnabled: _settings.promptEnabled,
              error: _liveError,
              onPromptToggle: _togglePrompt,
            ),
          ),
        if (local && _settings.agentActivityEnabled && _activity.isNotEmpty)
          FloatingPanel(
            title: 'Research Agent Activity',
            icon: Icons.auto_awesome_outlined,
            dock: _activityDock,
            collapsed: _activityCollapsed,
            width: math.min(480, mediaWidth - 24),
            expandedHeight: 330,
            onCollapsedChanged: (value) =>
                setState(() => _activityCollapsed = value),
            onDockChanged: (value) => setState(() => _activityDock = value),
            child: ListView(
              padding: const EdgeInsets.all(10),
              children: [
                for (final event in _activity.reversed.take(20))
                  _ActivityCard(
                    event: event,
                    location: ActivitySourceLocation.fromEvent(event),
                    onFocus: event.focusId == null
                        ? null
                        : () => setState(() => _requestedFocusId = event.focusId),
                    onLocationSelected: _showActivitySourceLocation,
                    onLocationHoverChanged: _setHoveredActivityLocation,
                    keptOpenLocation: _keptOpenActivityLocation,
                    onLocationKeepOpenChanged:
                        _toggleKeptOpenActivityLocation,
                  ),
              ],
            ),
          ),
        if (local &&
            _conversationAvailable &&
            (_conversation.isNotEmpty || _conversationDraft != null))
          FloatingPanel(
            title: 'Research Conversation',
            icon: Icons.forum_outlined,
            dock: _conversationDock,
            collapsed: _conversationCollapsed,
            width: math.min(430, mediaWidth - 24),
            expandedHeight: 300,
            onCollapsedChanged: (value) =>
                setState(() => _conversationCollapsed = value),
            onDockChanged: (value) =>
                setState(() => _conversationDock = value),
            child: ListView(
              padding: const EdgeInsets.all(10),
              children: [
                if (_conversationDraft != null &&
                    _conversationDraft!.clientId != _conversationClientId)
                  _ConversationDraftCard(draft: _conversationDraft!),
                for (final entry in _conversation.reversed.take(30))
                  _ConversationEntryCard(entry: entry),
              ],
            ),
          ),
        if (local && _settings.promptEnabled)
          FloatingPanel(
            title: 'Research Prompt',
            icon: Icons.terminal_outlined,
            dock: _promptDock,
            collapsed: _promptCollapsed,
            width: math.min(620, mediaWidth - 24),
            onCollapsedChanged: (value) =>
                setState(() => _promptCollapsed = value),
            onDockChanged: (value) => setState(() => _promptDock = value),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _promptController,
                    minLines: 1,
                    maxLines: 3,
                    decoration: const InputDecoration(
                        hintText: 'Research prompt', isDense: true),
                    onChanged: _scheduleDraftSync,
                    onSubmitted: (_) => _submitPrompt(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _submitting ? null : _submitPrompt,
                  child: Text(_submitting ? '...' : '送出'),
                ),
              ]),
            ),
          ),
        if (local &&
            _settings.replayEnabled &&
            _timeline?.hasEvents == true)
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: _ReplayBar(
              timeline: _timeline!,
              frame: _replayFrame,
              onChanged: _selectReplay,
              onLive: () => setState(() => _replayFrame = null),
            ),
          ),
      ],
    );
  }
}

class _WorkspaceStatusPanel extends StatelessWidget {
  const _WorkspaceStatusPanel({
    required this.probing,
    required this.repo,
    required this.change,
    required this.verification,
    required this.artifactDrift,
    required this.activity,
    required this.adapter,
    required this.orchestration,
    required this.replay,
    required this.promptEnabled,
    required this.error,
    required this.onPromptToggle,
  });

  final bool probing;
  final RepositoryStatus? repo;
  final ResearchChange? change;
  final VerificationState? verification;
  final ArtifactDrift? artifactDrift;
  final ActivityEvent? activity;
  final AdapterStatus? adapter;
  final OrchestrationSummary? orchestration;
  final ReplayTimeline? replay;
  final bool promptEnabled;
  final String? error;
  final VoidCallback onPromptToggle;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(10),
    child: Wrap(
      spacing: 8,
      runSpacing: 7,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _Pill(probing ? 'LOCAL · probing' : 'LIVE LOCAL',
            const Color(0xFF67E8F9)),
        if (repo != null)
          _Pill(
              'REPO ' +
                  repo!.dirtyCount.toString() +
                  ' dirty · ' +
                  repo!.driftCount.toString() +
                  ' drift',
              const Color(0xFF93C5FD)),
        if (change != null &&
            (change!.changedEntityIds.isNotEmpty ||
                change!.impactedTopicIds.isNotEmpty))
          _Pill(
              'CHANGE ' +
                  change!.changedEntityIds.length.toString() +
                  '/' +
                  change!.impactedTopicIds.length.toString(),
              const Color(0xFFFBBF24)),
        if (verification != null)
          _Pill(
              'VERIFY ' +
                  verification!.passed.length.toString() +
                  ' pass · ' +
                  verification!.failed.length.toString() +
                  ' fail',
              const Color(0xFF86EFAC)),
        if (artifactDrift != null && artifactDrift!.driftCount > 0)
          Tooltip(
            message:
                artifactDrift!.findings.map((x) => x.message).join('\n'),
            child: _Pill(
                'ARTIFACT ' +
                    artifactDrift!.driftCount.toString() +
                    ' drift',
                const Color(0xFFF59E0B)),
          ),
        if (activity != null)
          _Pill('AGENT ' + activity!.type, const Color(0xFF67E8F9)),
        if (adapter != null)
          _Pill(
            adapter!.label,
            adapter!.busy
                ? const Color(0xFFFBBF24)
                : adapter!.available
                ? const Color(0xFF86EFAC)
                : const Color(0xFF94A3B8),
          ),
        if (orchestration != null)
          _Pill(
            'ORCH ' +
                orchestration!.mode +
                ' · ' +
                orchestration!.score.toString() +
                ' · ' +
                orchestration!.assignments.length.toString() +
                '/' +
                orchestration!.maxSubagents.toString(),
            const Color(0xFFC4B5FD),
          ),
        if (replay != null && replay!.hasEvents)
          _Pill(
            'REPLAY ' +
                replay!.sessions.length.toString() +
                ' sessions · ' +
                replay!.milestones.length.toString() +
                ' milestones',
            const Color(0xFFA5B4FC),
          ),
        if (error != null)
          const _Pill('LOCAL API issue', Color(0xFFF87171)),
        FilledButton.tonal(
          onPressed: onPromptToggle,
          child: Text(promptEnabled ? 'Prompt ON' : 'Prompt OFF'),
        ),
      ],
    ),
  );
}

class _ConversationDraftCard extends StatelessWidget {
  const _ConversationDraftCard({required this.draft});
  final ConversationDraft draft;
  @override
  Widget build(BuildContext context) => _Card(
    accent: const Color(0xFFC4B5FD),
    title: 'REMOTE DRAFT',
    text: draft.text,
  );
}

class _ConversationEntryCard extends StatelessWidget {
  const _ConversationEntryCard({required this.entry});
  final ConversationEntry entry;
  @override
  Widget build(BuildContext context) {
    final accent = entry.kind == 'prompt'
        ? const Color(0xFF67E8F9)
        : entry.status == 'failed'
        ? const Color(0xFFF87171)
        : const Color(0xFF86EFAC);
    return _Card(
      accent: accent,
      title: (entry.source + ' · ' + entry.kind).toUpperCase(),
      text: entry.text,
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.accent, required this.title, required this.text});
  final Color accent;
  final String title;
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      color: const Color(0xFF0B1B29),
      border: Border.all(color: accent.withValues(alpha: .4)),
      borderRadius: BorderRadius.circular(9),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: TextStyle(
                color: accent, fontSize: 9, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        CollapsibleMessage(
          text: text,
          style: const TextStyle(
              color: Color(0xFFD7E5F4), fontSize: 11, height: 1.35),
        ),
      ],
    ),
  );
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({
    required this.event,
    required this.location,
    required this.onLocationSelected,
    required this.onLocationHoverChanged,
    required this.keptOpenLocation,
    required this.onLocationKeepOpenChanged,
    this.onFocus,
  });
  final ActivityEvent event;
  final ActivitySourceLocation? location;
  final VoidCallback? onFocus;
  final void Function(ActivitySourceLocation, Rect) onLocationSelected;
  final void Function(ActivitySourceLocation, bool) onLocationHoverChanged;
  final ActivitySourceLocation? keptOpenLocation;
  final ValueChanged<ActivitySourceLocation> onLocationKeepOpenChanged;

  @override
  Widget build(BuildContext context) {
    final current = location;
    final keptOpen = current?.matches(keptOpenLocation) ?? false;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: const Color(0xFF0B1B29),
        border: Border.all(
            color: keptOpen
                ? const Color(0xFF6D5B22)
                : const Color(0xFF29445A)),
        borderRadius: BorderRadius.circular(9),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text(event.type.toUpperCase(),
                  style: const TextStyle(
                      color: Color(0xFF67E8F9),
                      fontSize: 9,
                      fontWeight: FontWeight.w800)),
            ),
            Text('#' + event.sequence.toString(),
                style:
                    const TextStyle(color: Color(0xFF6B8199), fontSize: 9)),
          ]),
          const SizedBox(height: 5),
          CollapsibleMessage(
              text: event.summary,
              style: const TextStyle(
                  color: Color(0xFFD7E5F4), fontSize: 11, height: 1.35)),
          if (event.detail != null && event.detail!.trim().isNotEmpty)
            CollapsibleMessage(
                text: event.detail!,
                style: const TextStyle(
                    color: Color(0xFF9FB4CA),
                    fontFamily: 'monospace',
                    fontSize: 10)),
          if (current != null) ...[
            const SizedBox(height: 7),
            ActivitySourceLocationCard(
              location: current,
              keptOpen: keptOpen,
              onTap: (anchor) => onLocationSelected(current, anchor),
              onKeepOpenChanged: () => onLocationKeepOpenChanged(current),
              onHoverChanged: (value) =>
                  onLocationHoverChanged(current, value),
            ),
          ] else if (onFocus != null)
            TextButton.icon(
              onPressed: onFocus,
              icon: const Icon(Icons.center_focus_strong, size: 14),
              label: Text('聚焦 ' + (event.focusId ?? 'graph')),
            ),
        ],
      ),
    );
  }
}

class _ActivitySourceLocationPopover extends StatelessWidget {
  const _ActivitySourceLocationPopover({required this.location});
  final ActivitySourceLocation location;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 420,
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: SelectionArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('研究變更位置',
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            SelectableText(location.pathLabel,
                style: const TextStyle(fontFamily: 'monospace')),
            for (final target in location.semanticTargets)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: SelectableText(target,
                    style: const TextStyle(
                        color: Color(0xFF93C5FD),
                        fontFamily: 'monospace')),
              ),
          ],
        ),
      ),
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill(this.text, this.color);
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .08),
      border: Border.all(color: color.withValues(alpha: .45)),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(text,
        style:
            TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700)),
  );
}

class _ReplayBar extends StatelessWidget {
  const _ReplayBar({
    required this.timeline,
    required this.frame,
    required this.onChanged,
    required this.onLive,
  });
  final ReplayTimeline timeline;
  final ReplayFrame? frame;
  final ValueChanged<int> onChanged;
  final VoidCallback onLive;

  @override
  Widget build(BuildContext context) {
    final maxValue = math.max(timeline.latest, timeline.earliest + 1);
    final value =
        (frame?.sequence ?? timeline.latest).clamp(timeline.earliest, maxValue);
    return Material(
      color: const Color(0xF2071522),
      elevation: 12,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(children: [
          Text(frame == null
              ? 'REPLAY · LIVE'
              : 'REPLAY · ' + value.toString(),
              style: const TextStyle(
                  color: Color(0xFFC4B5FD),
                  fontWeight: FontWeight.w800,
                  fontSize: 11)),
          const SizedBox(width: 10),
          Expanded(
            child: Slider(
              min: timeline.earliest.toDouble(),
              max: maxValue.toDouble(),
              value: value.toDouble(),
              onChanged: (_) {},
              onChangeEnd: (v) => onChanged(v.round()),
            ),
          ),
          Text(
            timeline.eventCount.toString() +
                ' events · ' +
                timeline.checkpointCount.toString() +
                ' cp · ' +
                timeline.sessions.length.toString() +
                ' sessions · ' +
                timeline.milestones.length.toString() +
                ' milestones',
            style: const TextStyle(
                fontSize: 10, color: Color(0xFF9FB4CA)),
          ),
          const SizedBox(width: 8),
          FilledButton.tonal(
              onPressed: frame == null ? null : onLive,
              child: const Text('LIVE')),
        ]),
      ),
    );
  }
}
