import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../live/workspace_live.dart';
import '../model/graph_data.dart';
import '../model/graph_scene.dart';
import 'activity_location.dart';
import 'collapsible_message.dart';
import 'floating_panel.dart';

class GraphView extends StatefulWidget {
  const GraphView({super.key, required this.data});
  final GraphData data;

  @override
  State<GraphView> createState() => _GraphViewState();
}

class _GraphViewState extends State<GraphView>
    with SingleTickerProviderStateMixin {
  late GraphData _data;
  Camera3d _camera = const Camera3d();
  final Set<String> _expanded = {};
  final Set<String> _transientActivityExpanded = {};
  final Set<String> _enabledFilters = edgeFilterKeys.toSet();
  String? _selectedId;
  Offset? _lastFocal;
  double _gestureZoom = 1.02;
  late final AnimationController _activityPulse;
  bool _restoreBrowserContextMenu = false;

  WorkspaceLiveClient? _client;
  Timer? _pollTimer;
  Timer? _conversationTimer;
  Timer? _draftDebounce;
  RepositoryStatus? _repoStatus;
  ResearchChange? _change;
  VerificationState? _verification;
  ArtifactDrift? _artifactDrift;
  ActivityEvent? _activity;
  final List<ActivityEvent> _activityLog = <ActivityEvent>[];
  final List<ConversationEntry> _conversationLog = <ConversationEntry>[];
  int _conversationRevision = 0;
  ConversationDraft? _conversationDraft;
  final String _conversationClientId = 'viewer:' + DateTime.now().microsecondsSinceEpoch.toString();
  ReplayTimeline? _timeline;
  ReplayFrame? _replayFrame;
  ViewerSettings _settings = const ViewerSettings(
    promptEnabled: false,
    agentActivityEnabled: true,
    replayEnabled: true,
    changeAnimationsEnabled: true,
  );
  AdapterStatus? _adapter;
  String? _liveError;
  bool _probing = true;
  bool _submitting = false;
  final TextEditingController _promptController = TextEditingController();
  FloatingPanelDock _controlsDock = FloatingPanelDock.topRight;
  FloatingPanelDock _detailsDock = FloatingPanelDock.bottomRight;
  FloatingPanelDock _activityDock = FloatingPanelDock.topCenter;
  FloatingPanelDock _conversationDock = FloatingPanelDock.centerLeft;
  bool _controlsCollapsed = false;
  bool _detailsCollapsed = false;
  bool _activityCollapsed = true;
  bool _conversationCollapsed = true;
  ActivitySourceLocation? _hoveredActivityLocation;
  ActivitySourceLocation? _keptOpenActivityLocation;

  Set<String> get _visibleExpanded => {
    ..._expanded,
    ..._transientActivityExpanded,
  };

  GraphScene get _scene => buildGraphScene(
    _data,
    expanded: _visibleExpanded,
    enabledFilters: _enabledFilters,
  );
  bool get _conversationAvailable {
    final host = Uri.base.host.toLowerCase();
    return host == '127.0.0.1' || host == 'localhost' || host == '::1';
  }

  @override
  void initState() {
    super.initState();
    _data = widget.data;
    if (kIsWeb && BrowserContextMenu.enabled) {
      _restoreBrowserContextMenu = true;
      unawaited(BrowserContextMenu.disableContextMenu());
    }
    _activityPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    _probe();
  }

  @override
  void didUpdateWidget(covariant GraphView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.data, widget.data)) _data = widget.data;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _conversationTimer?.cancel();
    _draftDebounce?.cancel();
    _client?.close();
    _promptController.dispose();
    if (kIsWeb && _restoreBrowserContextMenu) {
      unawaited(BrowserContextMenu.enableContextMenu());
    }
    _activityPulse.dispose();
    super.dispose();
  }

  Future<void> _probe() async {
    final client = await WorkspaceLiveClient.probe();
    if (!mounted) {
      client?.close();
      return;
    }
    setState(() {
      _client = client;
      _probing = false;
    });
    if (client != null) {
      await _poll();
      _pollTimer = Timer.periodic(const Duration(milliseconds: 2200), (_) => _poll());
      if (_conversationAvailable) {
        await _pollConversation();
        _conversationTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) => _pollConversation());
      }
    }
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
        client.activity(after: _activity?.sequence ?? 0),
        client.replayTimeline(),
        client.viewerSettings(),
        client.adapterStatus(),
      ]);
      if (!mounted) return;
      final batch = results[5] as ActivityBatch;
      setState(() {
        _data = results[0] as GraphData;
        _repoStatus = results[1] as RepositoryStatus;
        _change = results[2] as ResearchChange;
        _verification = results[3] as VerificationState;
        _artifactDrift = results[4] as ArtifactDrift;
        if (batch.events.isNotEmpty) {
          final known = _activityLog.map((event) => event.sequence).toSet();
          for (final event in batch.events) {
            if (!known.contains(event.sequence)) _activityLog.add(event);
          }
          _activityLog.sort((a, b) => a.sequence.compareTo(b.sequence));
          if (_activityLog.length > 80) {
            _activityLog.removeRange(0, _activityLog.length - 80);
          }
          _activity = _activityLog.last;
          _syncTransientActivityExpansion(_liveActivityFocus);
        }
        _timeline = results[6] as ReplayTimeline;
        _settings = results[7] as ViewerSettings;
        _adapter = results[8] as AdapterStatus;
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
        final known = _conversationLog.map((entry) => entry.revision).toSet();
        for (final entry in snapshot.entries) {
          if (!known.contains(entry.revision)) _conversationLog.add(entry);
        }
        _conversationLog.sort((a, b) => a.revision.compareTo(b.revision));
        if (_conversationLog.length > 120) {
          _conversationLog.removeRange(0, _conversationLog.length - 120);
        }
        _conversationRevision = snapshot.latestRevision;
        _conversationDraft = snapshot.draft;
      });
    } catch (_) {
      // Conversation sync is private and optional; graph/live polling remains independent.
    }
  }

  void _scheduleDraftSync(String text) {
    if (!_conversationAvailable || _client == null) return;
    _draftDebounce?.cancel();
    _draftDebounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        await _client?.updateConversationDraft(_conversationClientId, text);
      } catch (_) {}
    });
  }

  void _reset() => setState(() {
    _camera = const Camera3d();
    _expanded.clear();
    _selectedId = null;
  });

  void _expandAll() => setState(() {
    _expanded
      ..clear()
      ..addAll(_data.topics.map((x) => x.id))
      ..addAll(_data.claims.map((x) => x.id))
      ..addAll(_data.sourceAreas.map((x) => x.id));
    _camera = _camera.copyWith(zoom: .58, panX: 0, panY: 0);
  });

  void _activate(String id) {
    final node = _scene.byId[id];
    if (node == null) return;
    setState(() {
      _selectedId = id;
      if (node.kind == 'topic' || node.kind == 'claim' || node.kind == 'source-area') {
        if (_expanded.contains(id)) {
          _expanded.remove(id);
          if (node.kind == 'topic') {
            for (final claim in _data.claims.where((x) => x.ownerId == id)) {
              _expanded.remove(claim.id);
            }
          }
        } else {
          _expanded.add(id);
        }
      }
    });
  }

  String? _hitTest(Offset point, Size size) {
    String? best;
    double bestDepth = -double.infinity;
    for (final node in _scene.nodes) {
      final p = _camera.project(node.position, size);
      final threshold = node.kind == 'root' ? 28.0 : node.kind == 'topic' ? 25.0 : 19.0;
      if ((p.offset - point).distance <= threshold && p.depth > bestDepth) {
        best = node.id;
        bestDepth = p.depth;
      }
    }
    return best;
  }

  Future<void> _togglePrompt() async {
    final client = _client;
    if (client == null) return;
    try {
      final next = await client.updateViewerSettings(_settings.copyWith(promptEnabled: !_settings.promptEnabled));
      if (mounted) setState(() => _settings = next);
    } catch (error) {
      if (mounted) setState(() => _liveError = error.toString());
    }
  }

  Future<void> _submitPrompt() async {
    final client = _client;
    final prompt = _promptController.text.trim();
    if (client == null || prompt.isEmpty || _submitting || !_settings.promptEnabled) return;
    setState(() => _submitting = true);
    try {
      final result = await client.submitPrompt(prompt);
      if (!mounted) return;
      setState(() {
        _activity = result.event;
        _promptController.clear();
        _conversationDraft = null;
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

  void _syncTransientActivityExpansion(String? targetId) {
    _transientActivityExpanded.clear();
    if (targetId == null || targetId.isEmpty) return;

    GraphClaim? claim;
    GraphSourceArea? area;
    GraphArtifact? artifact;

    for (final candidate in _data.claims) {
      if (candidate.id == targetId) {
        claim = candidate;
        break;
      }
    }
    for (final candidate in _data.sourceAreas) {
      if (candidate.id == targetId) {
        area = candidate;
        break;
      }
    }
    for (final candidate in _data.artifacts) {
      if (candidate.id == targetId) {
        artifact = candidate;
        break;
      }
    }

    if (artifact != null) {
      for (final candidate in _data.sourceAreas) {
        if (candidate.id == artifact.areaId) {
          area = candidate;
          break;
        }
      }
      _transientActivityExpanded.add(artifact.areaId);
    }

    if (area != null) {
      _transientActivityExpanded.add(area.claimId);
      for (final candidate in _data.claims) {
        if (candidate.id == area.claimId) {
          claim = candidate;
          break;
        }
      }
    }

    if (claim != null) {
      _transientActivityExpanded.add(claim.ownerId);
    }
  }

  String? get _liveActivityFocus =>
      (_keptOpenActivityLocation ?? _hoveredActivityLocation)?.semanticTarget ??
      _activity?.focusId;

  KeyEventResult _handleKey(GraphScene scene, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final nodes = scene.nodes;
    if (nodes.isEmpty) return KeyEventResult.ignored;

    if (event.logicalKey == LogicalKeyboardKey.home) {
      setState(() => _selectedId = _data.root.id);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.end) {
      setState(() => _selectedId = nodes.last.id);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      setState(() => _selectedId = null);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.space) {
      final id = _selectedId;
      if (id != null) _activate(id);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowRight ||
        event.logicalKey == LogicalKeyboardKey.arrowDown ||
        event.logicalKey == LogicalKeyboardKey.arrowLeft ||
        event.logicalKey == LogicalKeyboardKey.arrowUp) {
      final currentIndex = nodes.indexWhere((node) => node.id == _selectedId);
      final forward =
          event.logicalKey == LogicalKeyboardKey.arrowRight ||
          event.logicalKey == LogicalKeyboardKey.arrowDown;
      final next = currentIndex < 0
          ? 0
          : (currentIndex + (forward ? 1 : -1) + nodes.length) % nodes.length;
      setState(() => _selectedId = nodes[next].id);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  ActivitySourceLocation? _activityLocationFor(ActivityEvent event) =>
      ActivitySourceLocation.fromEvent(event);

  void _setHoveredActivityLocation(ActivitySourceLocation location, bool hovering) {
    final same = location.matches(_hoveredActivityLocation);
    if (hovering) {
      if (!same) {
        setState(() {
          _hoveredActivityLocation = location;
          _syncTransientActivityExpansion(_liveActivityFocus);
        });
      }
    } else if (same) {
      setState(() {
        _hoveredActivityLocation = null;
        _syncTransientActivityExpansion(_liveActivityFocus);
      });
    }
  }

  void _toggleKeptOpenActivityLocation(ActivitySourceLocation location) {
    setState(() {
      _keptOpenActivityLocation = location.matches(_keptOpenActivityLocation)
          ? null
          : location;
      _syncTransientActivityExpansion(_liveActivityFocus);
    });
  }

  void _showActivitySourceLocation(ActivitySourceLocation location, Rect anchor) {
    final overlay = Overlay.of(context, rootOverlay: true).context.findRenderObject();
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
    final scene = _scene;
    final selected = scene.byId[_selectedId];
    final mediaWidth = MediaQuery.sizeOf(context).width;
    final history = _replayFrame?.historicalEntityIds ?? const <String>{};

    return Stack(
      children: [
        Positioned.fill(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final size = Size(constraints.maxWidth, constraints.maxHeight);
              return Focus(
                autofocus: true,
                onKeyEvent: (_, event) => _handleKey(scene, event),
                child: Listener(
                  onPointerSignal: (event) {
                    if (event is PointerScrollEvent) {
                      setState(() => _camera = _camera.copyWith(
                        zoom: (_camera.zoom * math.exp(-event.scrollDelta.dy * .001)).clamp(.32, 3.2).toDouble(),
                      ));
                    }
                  },
                  onPointerMove: (event) {
                    if ((event.buttons & kSecondaryMouseButton) == 0) return;
                    setState(() => _camera = _camera.copyWith(
                      panX: _camera.panX + event.delta.dx,
                      panY: _camera.panY + event.delta.dy,
                    ));
                  },
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                  onScaleStart: (details) {
                    _lastFocal = details.focalPoint;
                    _gestureZoom = _camera.zoom;
                  },
                  onScaleUpdate: (details) {
                    final last = _lastFocal ?? details.focalPoint;
                    final delta = details.focalPoint - last;
                    setState(() {
                      if (details.pointerCount >= 2) {
                        _camera = _camera.copyWith(
                          zoom: (_gestureZoom * details.scale).clamp(.32, 3.2).toDouble(),
                          panX: _camera.panX + delta.dx,
                          panY: _camera.panY + delta.dy,
                        );
                      } else {
                        _camera = _camera.copyWith(
                          yaw: _camera.yaw + delta.dx * .008,
                          pitch: (_camera.pitch + delta.dy * .008).clamp(-1.28, 1.28).toDouble(),
                        );
                      }
                      _lastFocal = details.focalPoint;
                    });
                  },
                  onScaleEnd: (_) => _lastFocal = null,
                  onTapUp: (details) {
                    final id = _hitTest(details.localPosition, size);
                    if (id == null) {
                      setState(() => _selectedId = null);
                    } else {
                      _activate(id);
                    }
                  },
                  child: CustomPaint(
                    painter: _GraphPainter(
                      scene: scene,
                      camera: _camera,
                      selectedId: _selectedId,
                      changedEntityIds: _change?.changedEntityIds ?? const {},
                      impactedTopicIds: _change?.impactedTopicIds ?? const {},
                      runningVerification: _verification?.running ?? const {},
                      passedVerification: _verification?.passed ?? const {},
                      failedVerification: _verification?.failed ?? const {},
                      activityNodeId: _liveActivityFocus,
                      activityPulse: _activityPulse,
                      historicalEntityIds: history,
                    ),
                    size: Size.infinite,
                  ),
                ),
              ),
              );
            },
          ),
        ),
        Positioned(
          top: 12,
          left: 12,
          child: _Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('ResearchWorkspace', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                Text('3D Research Graph · ' + _data.snapshotDate, style: const TextStyle(color: Color(0xFF8FA5BD), fontSize: 11)),
                const SizedBox(height: 10),
                Wrap(spacing: 7, runSpacing: 7, children: [
                  FilledButton.tonal(onPressed: _reset, child: const Text('總覽')),
                  FilledButton.tonal(onPressed: _expandAll, child: const Text('全展開')),
                  if (_client != null)
                    FilledButton.tonal(onPressed: _togglePrompt, child: Text(_settings.promptEnabled ? 'Prompt ON' : 'Prompt OFF')),
                ]),
                const SizedBox(height: 8),
                Text(
                  _data.topics.length.toString() + ' topics · ' +
                  _data.claims.length.toString() + ' claims · ' +
                  _data.evidence.length.toString() + ' evidence',
                  style: const TextStyle(fontSize: 11, color: Color(0xFFBDD0E5)),
                ),
                if (_probing) const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text('LOCAL · probing', style: TextStyle(fontSize: 10, color: Color(0xFF8FA5BD))),
                ),
              ],
            ),
          ),
        ),
        if (_client != null)
          Positioned(
            top: 12,
            left: mediaWidth > 850 ? 350 : 12,
            child: _LiveStrip(
              repo: _repoStatus,
              change: _change,
              verification: _verification,
              artifactDrift: _artifactDrift,
              activity: _activity,
              adapter: _adapter,
              error: _liveError,
            ),
          ),
        if (_client != null && _conversationAvailable && (_conversationLog.isNotEmpty || _conversationDraft != null))
          FloatingPanel(
            title: 'Research Conversation',
            icon: Icons.forum_outlined,
            dock: _conversationDock,
            collapsed: _conversationCollapsed,
            width: math.min(430, mediaWidth - 24),
            expandedHeight: 300,
            onCollapsedChanged: (value) => setState(() => _conversationCollapsed = value),
            onDockChanged: (value) => setState(() => _conversationDock = value),
            child: ListView(
              padding: const EdgeInsets.all(10),
              children: [
                if (_conversationDraft != null && _conversationDraft!.clientId != _conversationClientId)
                  _ConversationDraftCard(draft: _conversationDraft!),
                for (final entry in _conversationLog.reversed.take(30))
                  _ConversationEntryCard(entry: entry),
              ],
            ),
          ),
        if (_client != null && _settings.agentActivityEnabled && _activityLog.isNotEmpty)
          FloatingPanel(
            title: 'Research Agent Activity',
            icon: Icons.auto_awesome_outlined,
            dock: _activityDock,
            collapsed: _activityCollapsed,
            width: math.min(430, mediaWidth - 24),
            expandedHeight: 320,
            onCollapsedChanged: (value) => setState(() => _activityCollapsed = value),
            onDockChanged: (value) => setState(() => _activityDock = value),
            child: ListView(
              padding: const EdgeInsets.all(10),
              children: [
                for (final event in _activityLog.reversed.take(20))
                  _ActivityCard(
                    event: event,
                    location: _activityLocationFor(event),
                    onFocus: event.focusId == null ? null : () => _activate(event.focusId!),
                    onLocationSelected: _showActivitySourceLocation,
                    onLocationHoverChanged: _setHoveredActivityLocation,
                    keptOpenLocation: _keptOpenActivityLocation,
                    onLocationKeepOpenChanged: _toggleKeptOpenActivityLocation,
                  ),
              ],
            ),
          ),
        FloatingPanel(
          title: 'Research Relations',
          icon: Icons.tune,
          dock: _controlsDock,
          collapsed: _controlsCollapsed,
          width: math.min(360, mediaWidth - 24),
          expandedHeight: 300,
          onCollapsedChanged: (value) => setState(() => _controlsCollapsed = value),
          onDockChanged: (value) => setState(() => _controlsDock = value),
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 6),
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Wrap(
                  spacing: 7,
                  children: [
                    TextButton(
                      onPressed: () => setState(() {
                        _enabledFilters
                          ..clear()
                          ..addAll(edgeFilterKeys);
                      }),
                      child: const Text('全部開啟'),
                    ),
                    TextButton(
                      onPressed: () => setState(_enabledFilters.clear),
                      child: const Text('全部關閉'),
                    ),
                  ],
                ),
              ),
              for (final key in edgeFilterKeys)
                CheckboxListTile(
                  dense: true,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: _enabledFilters.contains(key),
                  title: Text(edgeFilterLabels[key] ?? key, style: const TextStyle(fontSize: 11)),
                  subtitle: Text(key, style: const TextStyle(fontFamily: 'monospace', fontSize: 9, color: Color(0xFF7890A8))),
                  onChanged: (enabled) => setState(() {
                    if (enabled == true) {
                      _enabledFilters.add(key);
                    } else {
                      _enabledFilters.remove(key);
                    }
                  }),
                ),
            ],
          ),
        ),
        if (selected != null)
          FloatingPanel(
            title: selected.label,
            icon: Icons.account_tree_outlined,
            dock: _detailsDock,
            collapsed: _detailsCollapsed,
            width: math.min(430, mediaWidth - 24),
            expandedHeight: math.max(180, MediaQuery.sizeOf(context).height - 96),
            onCollapsedChanged: (value) => setState(() => _detailsCollapsed = value),
            onDockChanged: (value) => setState(() => _detailsDock = value),
            onClose: () => setState(() => _selectedId = null),
            child: ListView(
              padding: const EdgeInsets.all(14),
              shrinkWrap: true,
              children: [
                Text(selected.kind.toUpperCase(), style: const TextStyle(color: Color(0xFF67E8F9), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                const SizedBox(height: 5),
                Text(selected.label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 8),
                CollapsibleMessage(text: selected.summary, style: const TextStyle(color: Color(0xFFB8C9DA), height: 1.5)),
                if (selected.status != null) _InfoItem('STATUS · ' + selected.status!),
                if (selected.detail != null) _InfoItem(selected.detail!),
                const SizedBox(height: 12),
                Text(
                  selected.kind == 'topic' || selected.kind == 'claim' || selected.kind == 'source-area'
                    ? (_visibleExpanded.contains(selected.id) ? 'Expanded semantic cluster' : 'Tap again to expand semantic cluster')
                    : 'Evidence-level node',
                  style: const TextStyle(color: Color(0xFF8FA5BD), fontSize: 11),
                ),
              ],
            ),
          ),
        if (_client != null && _settings.promptEnabled)
          Positioned(
            left: 12,
            right: selected == null ? 12 : math.min(455, mediaWidth - 12),
            bottom: _timeline?.hasEvents == true ? 76 : 12,
            child: _Panel(
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _promptController,
                    minLines: 1,
                    maxLines: 3,
                    decoration: const InputDecoration(hintText: 'Research prompt', isDense: true),
                    onChanged: _scheduleDraftSync,
                    onSubmitted: (_) => _submitPrompt(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(onPressed: _submitting ? null : _submitPrompt, child: Text(_submitting ? '...' : '送出')),
              ]),
            ),
          ),
        if (_client != null && _settings.replayEnabled && _timeline?.hasEvents == true)
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
        if (_client == null)
          Positioned(
            left: 12,
            bottom: 12,
            child: _Panel(
              child: const Text('左鍵/一指拖曳旋轉 · 右鍵拖曳平移 · 兩指縮放＋平移 · 滾輪縮放 · 方向鍵選取 · Enter 展開', style: TextStyle(fontSize: 11, color: Color(0xFFA9BDD0))),
            ),
          ),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(maxWidth: 520),
    padding: const EdgeInsets.all(13),
    decoration: BoxDecoration(
      color: const Color(0xF2071522),
      border: Border.all(color: const Color(0xFF2D435C)),
      borderRadius: BorderRadius.circular(13),
      boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 30, offset: Offset(0, 12))],
    ),
    child: child,
  );
}

class _InfoItem extends StatelessWidget {
  const _InfoItem(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 8),
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      color: const Color(0xFF102033),
      border: Border.all(color: const Color(0xFF334B63)),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFFD7E5F4))),
  );
}

class _ConversationDraftCard extends StatelessWidget {
  const _ConversationDraftCard({required this.draft});
  final ConversationDraft draft;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      color: const Color(0xFF1E1627),
      border: Border.all(color: const Color(0xFF6D4C78)),
      borderRadius: BorderRadius.circular(9),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('REMOTE DRAFT', style: TextStyle(color: Color(0xFFC4B5FD), fontSize: 9, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        CollapsibleMessage(text: draft.text, style: const TextStyle(color: Color(0xFFE9D5FF), fontSize: 11, height: 1.35)),
      ],
    ),
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
    return Container(
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
          Text((entry.source + ' · ' + entry.kind).toUpperCase(), style: TextStyle(color: accent, fontSize: 9, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          CollapsibleMessage(text: entry.text, style: const TextStyle(color: Color(0xFFD7E5F4), fontSize: 11, height: 1.35)),
        ],
      ),
    );
  }
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
  final void Function(ActivitySourceLocation location, Rect anchor) onLocationSelected;
  final void Function(ActivitySourceLocation location, bool hovering) onLocationHoverChanged;
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
        border: Border.all(color: keptOpen ? const Color(0xFF6D5B22) : const Color(0xFF29445A)),
        borderRadius: BorderRadius.circular(9),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text(event.type.toUpperCase(), style: const TextStyle(color: Color(0xFF67E8F9), fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: .7))),
            Text('#' + event.sequence.toString(), style: const TextStyle(color: Color(0xFF6B8199), fontSize: 9)),
          ]),
          const SizedBox(height: 5),
          CollapsibleMessage(text: event.summary, style: const TextStyle(color: Color(0xFFD7E5F4), fontSize: 11, height: 1.35)),
          if (event.detail != null && event.detail!.trim().isNotEmpty) ...[
            const SizedBox(height: 5),
            CollapsibleMessage(text: event.detail!, style: const TextStyle(color: Color(0xFF9FB4CA), fontFamily: 'monospace', fontSize: 10, height: 1.3)),
          ],
          if (current != null) ...[
            const SizedBox(height: 7),
            ActivitySourceLocationCard(
              location: current,
              keptOpen: keptOpen,
              onTap: (anchor) => onLocationSelected(current, anchor),
              onKeepOpenChanged: () => onLocationKeepOpenChanged(current),
              onHoverChanged: (hovering) => onLocationHoverChanged(current, hovering),
            ),
          ] else if (onFocus != null) ...[
            const SizedBox(height: 5),
            TextButton.icon(onPressed: onFocus, icon: const Icon(Icons.center_focus_strong, size: 14), label: Text('聚焦 ' + (event.focusId ?? 'graph'))),
          ],
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
            const Row(children: [
              Icon(Icons.edit_note_outlined, color: Color(0xFF67E8F9)),
              SizedBox(width: 8),
              Text('研究變更位置', style: TextStyle(fontWeight: FontWeight.w800)),
            ]),
            const SizedBox(height: 10),
            const Text(
              '這是目前 Agent Activity 的即時研究定位；位置資訊只來自事件 metadata，不額外維護第二份 modified-files 清單。',
              style: TextStyle(fontSize: 12, height: 1.4),
            ),
            const SizedBox(height: 14),
            _SourceLocationField(label: 'Repository', value: location.repository),
            _SourceLocationField(label: '相對路徑', value: location.file),
            for (final target in location.semanticTargets)
              _SourceLocationField(label: '語意位置', value: target),
          ],
        ),
      ),
    ),
  );
}

class _SourceLocationField extends StatelessWidget {
  const _SourceLocationField({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        SelectableText(value, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, height: 1.35)),
      ],
    ),
  );
}

class _LiveStrip extends StatelessWidget {
  const _LiveStrip({required this.repo, required this.change, required this.verification, required this.artifactDrift, required this.activity, required this.adapter, required this.error});
  final RepositoryStatus? repo;
  final ResearchChange? change;
  final VerificationState? verification;
  final ArtifactDrift? artifactDrift;
  final ActivityEvent? activity;
  final AdapterStatus? adapter;
  final String? error;

  @override
  Widget build(BuildContext context) => _Panel(
    child: Wrap(
      spacing: 8,
      runSpacing: 6,
      children: [
        _Pill('LIVE LOCAL', const Color(0xFF67E8F9)),
        if (repo != null) _Pill('REPO ' + repo!.dirtyCount.toString() + ' dirty · ' + repo!.driftCount.toString() + ' drift', const Color(0xFF93C5FD)),
        if (change != null && (change!.changedEntityIds.isNotEmpty || change!.impactedTopicIds.isNotEmpty))
          _Pill('CHANGE ' + change!.changedEntityIds.length.toString() + '/' + change!.impactedTopicIds.length.toString(), const Color(0xFFFBBF24)),
        if (verification != null)
          _Pill('VERIFY ' + verification!.passed.length.toString() + ' pass · ' + verification!.failed.length.toString() + ' fail', const Color(0xFF86EFAC)),
        if (artifactDrift != null && artifactDrift!.driftCount > 0)
          Tooltip(
            message: artifactDrift!.findings.map((x) => x.message).join('\n'),
            child: _Pill('ARTIFACT ' + artifactDrift!.driftCount.toString() + ' drift', const Color(0xFFF59E0B)),
          ),
        if (activity != null) _Pill('AGENT ' + activity!.type, const Color(0xFF67E8F9)),
        if (adapter != null) _Pill(adapter!.enabled ? 'ADAPTER ready' : 'ADAPTER off', adapter!.enabled ? const Color(0xFF86EFAC) : const Color(0xFF94A3B8)),
        if (error != null) _Pill('LOCAL API issue', const Color(0xFFF87171)),
      ],
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
    child: Text(text, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700)),
  );
}

class _ReplayBar extends StatelessWidget {
  const _ReplayBar({required this.timeline, required this.frame, required this.onChanged, required this.onLive});
  final ReplayTimeline timeline;
  final ReplayFrame? frame;
  final ValueChanged<int> onChanged;
  final VoidCallback onLive;

  @override
  Widget build(BuildContext context) {
    final value = (frame?.sequence ?? timeline.latest).clamp(timeline.earliest, timeline.latest);
    return _Panel(
      child: Row(children: [
        Text(frame == null ? 'REPLAY · LIVE' : 'REPLAY · ' + value.toString(), style: const TextStyle(color: Color(0xFFC4B5FD), fontWeight: FontWeight.w800, fontSize: 11)),
        const SizedBox(width: 10),
        Expanded(
          child: Slider(
            min: timeline.earliest.toDouble(),
            max: math.max(timeline.latest, timeline.earliest + 1).toDouble(),
            value: value.toDouble().clamp(timeline.earliest.toDouble(), math.max(timeline.latest, timeline.earliest + 1).toDouble()),
            onChanged: (_) {},
            onChangeEnd: (v) => onChanged(v.round()),
          ),
        ),
        Text(timeline.eventCount.toString() + ' events', style: const TextStyle(fontSize: 10, color: Color(0xFF9FB4CA))),
        const SizedBox(width: 8),
        FilledButton.tonal(onPressed: frame == null ? null : onLive, child: const Text('LIVE')),
      ]),
    );
  }
}

class _GraphPainter extends CustomPainter {
  const _GraphPainter({
    required this.scene,
    required this.camera,
    required this.selectedId,
    required this.changedEntityIds,
    required this.impactedTopicIds,
    required this.runningVerification,
    required this.passedVerification,
    required this.failedVerification,
    required this.activityNodeId,
    required this.activityPulse,
    required this.historicalEntityIds,
  }) : super(repaint: activityPulse);
  final GraphScene scene;
  final Camera3d camera;
  final String? selectedId;
  final Set<String> changedEntityIds;
  final Set<String> impactedTopicIds;
  final Set<String> runningVerification;
  final Set<String> passedVerification;
  final Set<String> failedVerification;
  final String? activityNodeId;
  final Animation<double> activityPulse;
  final Set<String> historicalEntityIds;

  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()..shader = const RadialGradient(
      center: Alignment(-.18, -.68),
      radius: 1.15,
      colors: [Color(0xFF12304C), Color(0xFF081522), Color(0xFF050B14)],
    ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, bg);

    final projected = {for (final n in scene.nodes) n.id: camera.project(n.position, size)};
    for (final cluster in scene.clusters) {
      if (historicalEntityIds.isNotEmpty && !historicalEntityIds.contains(cluster.ownerId)) continue;
      final p = projected[cluster.ownerId];
      if (p == null) continue;
      final r = math.max(42.0, cluster.radius * p.scale);
      canvas.drawOval(
        Rect.fromCenter(center: p.offset, width: r * 1.6, height: r * .56),
        Paint()
          ..color = const Color(0xFF60A5FA).withValues(alpha: .18)
          ..style = PaintingStyle.stroke,
      );
    }

    for (final edge in scene.edges) {
      if (historicalEntityIds.isNotEmpty && (!historicalEntityIds.contains(edge.from) || !historicalEntityIds.contains(edge.to))) continue;
      final a = projected[edge.from];
      final b = projected[edge.to];
      if (a == null || b == null) continue;
      final changed = changedEntityIds.contains(edge.id) || changedEntityIds.contains(edge.from) || changedEntityIds.contains(edge.to);
      final vStatus = failedVerification.contains(edge.from) || failedVerification.contains(edge.to)
          ? 'failed'
          : runningVerification.contains(edge.from) || runningVerification.contains(edge.to)
          ? 'running'
          : passedVerification.contains(edge.from) || passedVerification.contains(edge.to)
          ? 'passed'
          : null;
      final color = changed
          ? const Color(0xFFFBBF24)
          : vStatus != null && edge.type == 'validated-by'
          ? _verificationColor(vStatus)
          : _edgeColor(edge.type);
      canvas.drawLine(
        a.offset,
        b.offset,
        Paint()
          ..color = color.withValues(alpha: changed ? .94 : .58)
          ..strokeWidth = changed ? 2.7 : vStatus != null && edge.type == 'validated-by' ? 2.5 : 1.4,
      );
    }

    final ordered = [...scene.nodes]
      ..sort((a, b) => projected[a.id]!.depth.compareTo(projected[b.id]!.depth));
    for (final node in ordered) {
      if (historicalEntityIds.isNotEmpty && !historicalEntityIds.contains(node.id)) continue;
      final p = projected[node.id]!;
      final selected = node.id == selectedId;
      final base = node.kind == 'root' ? 18.0 : node.kind == 'topic' ? 13.0 : node.kind == 'claim' ? 8.0 : 5.8;
      final radius = math.max(node.isChild ? 4.5 : 8.0, base * p.scale);
      final color = _nodeColor(node);

      if (node.kind == 'topic' && impactedTopicIds.contains(node.id)) _ring(canvas, p.offset, radius + 14, const Color(0xFFA78BFA), 2.2);
      if (changedEntityIds.contains(node.id)) _ring(canvas, p.offset, radius + 11, const Color(0xFFFBBF24), 2.4);
      final vStatus = failedVerification.contains(node.id) ? 'failed' : runningVerification.contains(node.id) ? 'running' : passedVerification.contains(node.id) ? 'passed' : null;
      if (vStatus != null) _ring(canvas, p.offset, radius + 8, _verificationColor(vStatus), 2.5);
      if (activityNodeId == node.id) {
        final pulse = (math.sin(activityPulse.value * math.pi * 2) + 1) * .5;
        _ring(canvas, p.offset, radius + 12 + pulse * 8, const Color(0xFF67E8F9), 2.4);
      }
      if (selected) _ring(canvas, p.offset, radius + 7, Colors.white, 2.4);

      canvas.drawCircle(p.offset, radius, Paint()..color = color);
      final tp = TextPainter(
        text: TextSpan(
          text: node.label,
          style: TextStyle(
            color: selected ? Colors.white : const Color(0xFFDBEAFE),
            fontSize: node.isChild ? 10.5 : 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
        ellipsis: '…',
      )..layout(maxWidth: node.isChild ? 230 : 190);
      tp.paint(canvas, p.offset + Offset(radius + 6, -tp.height / 2));
    }
  }

  void _ring(Canvas canvas, Offset center, double radius, Color color, double width) {
    canvas.drawCircle(center, radius, Paint()..color = color.withValues(alpha: .9)..style = PaintingStyle.stroke..strokeWidth = width);
  }

  Color _nodeColor(VisualNode node) => switch (node.kind) {
    'root' => const Color(0xFF67E8F9),
    'topic' => const Color(0xFF60A5FA),
    'claim' when node.status == 'NOT_SUPPORTED' => const Color(0xFFFB7185),
    'claim' when node.status == 'PARTIAL' => const Color(0xFFF59E0B),
    'claim' => const Color(0xFFFBBF24),
    'study' => const Color(0xFFA78BFA),
    'source-area' => const Color(0xFFF472B6),
    'artifact' => const Color(0xFFA7F3D0),
    'evidence' => const Color(0xFF34D399),
    'review' when node.status == 'FAIL' => const Color(0xFFFB7185),
    'review' when node.status == 'WARN' => const Color(0xFFFBBF24),
    'review' => const Color(0xFF4ADE80),
    _ => const Color(0xFF94A3B8),
  };

  Color _edgeColor(String type) => switch (type) {
    'contains' => const Color(0xFF60A5FA),
    'supports' => const Color(0xFF34D399),
    'uses-method' => const Color(0xFFA78BFA),
    'grounded-in' => const Color(0xFF22D3EE),
    'validated-by' => const Color(0xFF4ADE80),
    'limits' => const Color(0xFFFB7185),
    _ => const Color(0xFF64748B),
  };

  Color _verificationColor(String status) => switch (status) {
    'failed' => const Color(0xFFF87171),
    'running' => const Color(0xFF67E8F9),
    'passed' => const Color(0xFF86EFAC),
    _ => const Color(0xFF94A3B8),
  };

  @override
  bool shouldRepaint(covariant _GraphPainter oldDelegate) => true;
}
