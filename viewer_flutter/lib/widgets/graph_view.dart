import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../live/workspace_live.dart';
import '../model/graph_data.dart';
import '../model/graph_scene.dart';

class GraphView extends StatefulWidget {
  const GraphView({super.key, required this.data});
  final GraphData data;

  @override
  State<GraphView> createState() => _GraphViewState();
}

class _GraphViewState extends State<GraphView> {
  Camera3d _camera = const Camera3d();
  final Set<String> _expanded = {};
  String? _selectedId;
  Offset? _lastFocal;
  double _gestureZoom = 1.02;

  WorkspaceLiveClient? _client;
  Timer? _pollTimer;
  RepositoryStatus? _repoStatus;
  ResearchChange? _change;
  VerificationState? _verification;
  ArtifactDrift? _artifactDrift;
  ActivityEvent? _activity;
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

  GraphScene get _scene => buildGraphScene(widget.data, expanded: _expanded);

  @override
  void initState() {
    super.initState();
    _probe();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _client?.close();
    _promptController.dispose();
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
    }
  }

  Future<void> _poll() async {
    final client = _client;
    if (client == null) return;
    try {
      final results = await Future.wait<Object>([
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
      final batch = results[4] as ActivityBatch;
      setState(() {
        _repoStatus = results[0] as RepositoryStatus;
        _change = results[1] as ResearchChange;
        _verification = results[2] as VerificationState;
        _artifactDrift = results[3] as ArtifactDrift;
        if (batch.events.isNotEmpty) _activity = batch.events.last;
        _timeline = results[5] as ReplayTimeline;
        _settings = results[6] as ViewerSettings;
        _adapter = results[7] as AdapterStatus;
        _liveError = null;
      });
    } catch (error) {
      if (mounted) setState(() => _liveError = error.toString());
    }
  }

  void _reset() => setState(() {
    _camera = const Camera3d();
    _expanded.clear();
    _selectedId = null;
  });

  void _expandAll() => setState(() {
    _expanded
      ..clear()
      ..addAll(widget.data.topics.map((x) => x.id))
      ..addAll(widget.data.claims.map((x) => x.id))
      ..addAll(widget.data.sourceAreas.map((x) => x.id));
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
            for (final claim in widget.data.claims.where((x) => x.ownerId == id)) {
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
              return Listener(
                onPointerSignal: (event) {
                  if (event is PointerScrollEvent) {
                    setState(() => _camera = _camera.copyWith(
                      zoom: (_camera.zoom * math.exp(-event.scrollDelta.dy * .001)).clamp(.32, 3.2).toDouble(),
                    ));
                  }
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
                    if (id != null) _activate(id);
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
                      activityNodeId: _activity?.focusId,
                      historicalEntityIds: history,
                    ),
                    size: Size.infinite,
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
                Text('3D Research Graph · ' + widget.data.snapshotDate, style: const TextStyle(color: Color(0xFF8FA5BD), fontSize: 11)),
                const SizedBox(height: 10),
                Wrap(spacing: 7, runSpacing: 7, children: [
                  FilledButton.tonal(onPressed: _reset, child: const Text('總覽')),
                  FilledButton.tonal(onPressed: _expandAll, child: const Text('全展開')),
                  if (_client != null)
                    FilledButton.tonal(onPressed: _togglePrompt, child: Text(_settings.promptEnabled ? 'Prompt ON' : 'Prompt OFF')),
                ]),
                const SizedBox(height: 8),
                Text(
                  widget.data.topics.length.toString() + ' topics · ' +
                  widget.data.claims.length.toString() + ' claims · ' +
                  widget.data.evidence.length.toString() + ' evidence',
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
        if (selected != null)
          Positioned(
            right: 12,
            top: 12,
            bottom: 12,
            child: SizedBox(
              width: math.min(430, mediaWidth - 24),
              child: _Panel(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    Text(selected.kind.toUpperCase(), style: const TextStyle(color: Color(0xFF67E8F9), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                    const SizedBox(height: 5),
                    Text(selected.label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    const SizedBox(height: 8),
                    Text(selected.summary, style: const TextStyle(color: Color(0xFFB8C9DA), height: 1.5)),
                    if (selected.status != null) _InfoItem('STATUS · ' + selected.status!),
                    if (selected.detail != null) _InfoItem(selected.detail!),
                    const SizedBox(height: 12),
                    Text(
                      selected.kind == 'topic' || selected.kind == 'claim' || selected.kind == 'source-area'
                        ? (_expanded.contains(selected.id) ? 'Expanded semantic cluster' : 'Tap again to expand semantic cluster')
                        : 'Evidence-level node',
                      style: const TextStyle(color: Color(0xFF8FA5BD), fontSize: 11),
                    ),
                  ],
                ),
              ),
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
              child: const Text('一指拖曳旋轉 · 兩指縮放＋平移 · 滾輪縮放 · 點 Topic / Claim 逐層展開', style: TextStyle(fontSize: 11, color: Color(0xFFA9BDD0))),
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
    required this.historicalEntityIds,
  });
  final GraphScene scene;
  final Camera3d camera;
  final String? selectedId;
  final Set<String> changedEntityIds;
  final Set<String> impactedTopicIds;
  final Set<String> runningVerification;
  final Set<String> passedVerification;
  final Set<String> failedVerification;
  final String? activityNodeId;
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
      if (activityNodeId == node.id) _ring(canvas, p.offset, radius + 17, const Color(0xFF67E8F9), 2.4);
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
