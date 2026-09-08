import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../model/graph_data.dart';
import '../model/graph_scene.dart';
import 'collapsible_message.dart';
import 'floating_panel.dart';

/// Pure 3D research graph surface.
///
/// Totem parity rule: transport/polling/prompt/replay/conversation state belongs
/// to WorkspaceGraphHost. GraphView owns camera, semantic LOD, relation filters,
/// selection/spotlight and drawing only.
class GraphView extends StatefulWidget {
  const GraphView({
    super.key,
    required this.data,
    this.activityNodeId,
    this.focusNodeId,
    this.autoExpandAgentFocus = true,
    this.changedEntityIds = const <String>{},
    this.impactedTopicIds = const <String>{},
    this.changeAnimationsEnabled = true,
    this.runningVerificationTargetIds = const <String>{},
    this.passedVerificationTargetIds = const <String>{},
    this.failedVerificationTargetIds = const <String>{},
    this.historicalEntityIds = const <String>{},
  });

  final GraphData data;
  final String? activityNodeId;
  final String? focusNodeId;
  final bool autoExpandAgentFocus;
  final Set<String> changedEntityIds;
  final Set<String> impactedTopicIds;
  final bool changeAnimationsEnabled;
  final Set<String> runningVerificationTargetIds;
  final Set<String> passedVerificationTargetIds;
  final Set<String> failedVerificationTargetIds;
  final Set<String> historicalEntityIds;

  @override
  State<GraphView> createState() => _GraphViewState();
}

class _GraphViewState extends State<GraphView>
    with SingleTickerProviderStateMixin {
  bool _paperFirst = true;
  int _relationshipLimit = 40;
  Camera3d _camera = const Camera3d();
  final Set<String> _expanded = <String>{};
  final Set<String> _transientActivityExpanded = <String>{};
  final Set<String> _enabledFilters = edgeFilterKeys.toSet();
  String? _selectedId;
  Offset? _lastFocal;
  double _gestureZoom = 1.02;
  late final AnimationController _activityPulse;
  bool _restoreBrowserContextMenu = false;

  FloatingPanelDock _controlsDock = FloatingPanelDock.topRight;
  FloatingPanelDock _detailsDock = FloatingPanelDock.bottomRight;
  bool _controlsCollapsed = false;
  bool _detailsCollapsed = false;

  Set<String> get _visibleExpanded => <String>{
    ..._expanded,
    ..._transientActivityExpanded,
  };

  GraphScene get _scene => buildGraphScene(
    widget.data,
    paperFirst: _paperFirst,
    expanded: _visibleExpanded,
    enabledFilters: _enabledFilters,
  );

  @override
  void initState() {
    super.initState();
    if (kIsWeb && BrowserContextMenu.enabled) {
      _restoreBrowserContextMenu = true;
      unawaited(BrowserContextMenu.disableContextMenu());
    }
    _activityPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    _syncTransientActivityExpansion(widget.activityNodeId);
    _selectedId = widget.focusNodeId;
  }

  @override
  void didUpdateWidget(covariant GraphView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.data != widget.data ||
        oldWidget.activityNodeId != widget.activityNodeId ||
        oldWidget.autoExpandAgentFocus != widget.autoExpandAgentFocus) {
      setState(() => _syncTransientActivityExpansion(widget.activityNodeId));
    }
    if (widget.focusNodeId != null && oldWidget.focusNodeId != widget.focusNodeId) {
      setState(() => _selectedId = widget.focusNodeId);
    }
  }

  @override
  void dispose() {
    if (kIsWeb && _restoreBrowserContextMenu) {
      unawaited(BrowserContextMenu.enableContextMenu());
    }
    _activityPulse.dispose();
    super.dispose();
  }

  void _syncTransientActivityExpansion(String? targetId) {
    _transientActivityExpanded.clear();
    if (!widget.autoExpandAgentFocus || targetId == null || targetId.isEmpty) {
      return;
    }

    GraphClaim? claim;
    GraphSourceArea? area;
    GraphArtifact? artifact;
    for (final candidate in widget.data.claims) {
      if (candidate.id == targetId) {
        claim = candidate;
        break;
      }
    }
    for (final candidate in widget.data.sourceAreas) {
      if (candidate.id == targetId) {
        area = candidate;
        break;
      }
    }
    for (final candidate in widget.data.artifacts) {
      if (candidate.id == targetId) {
        artifact = candidate;
        break;
      }
    }

    if (artifact != null) {
      _transientActivityExpanded.add(artifact.areaId);
      for (final candidate in widget.data.sourceAreas) {
        if (candidate.id == artifact.areaId) {
          area = candidate;
          break;
        }
      }
    }
    if (area != null) {
      _transientActivityExpanded.add(area.claimId);
      for (final candidate in widget.data.claims) {
        if (candidate.id == area.claimId) {
          claim = candidate;
          break;
        }
      }
    }
    if (claim != null) _transientActivityExpanded.add(claim.ownerId);
  }

  void _reset() => setState(() {
    _camera = const Camera3d();
    _expanded.clear();
    _selectedId = null;
  });

  void _expandAll() => setState(() {
    _expanded
      ..clear()
      ..addAll(widget.data.paperNodes.map((x) => x.id))
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
      _relationshipLimit = 40;
      if (widget.data.paperNodes.any((n) => n.parentId == id) || node.kind == 'topic' || node.kind == 'claim' || node.kind == 'source-area') {
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
      final threshold = node.kind == 'root'
          ? 28.0
          : node.kind == 'topic'
          ? 25.0
          : 19.0;
      if ((p.offset - point).distance <= threshold && p.depth > bestDepth) {
        best = node.id;
        bestDepth = p.depth;
      }
    }
    return best;
  }

  KeyEventResult _handleKey(GraphScene scene, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final nodes = scene.nodes;
    if (nodes.isEmpty) return KeyEventResult.ignored;
    if (event.logicalKey == LogicalKeyboardKey.home) {
      setState(() => _selectedId = widget.data.root.id);
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

  @override
  Widget build(BuildContext context) {
    final scene = _scene;
    final selected = scene.byId[_selectedId];
    final relationships = selected == null
        ? const <VisualEdge>[]
        : scene.edges
            .where((edge) => edge.from == selected.id || edge.to == selected.id)
            .toList(growable: false);
    final paperMap = {for (final n in widget.data.paperNodes) n.id: n};
    bool belongs(String id, String owner) {
      String? current = id;
      while (current != null) { if (current == owner) return true; current = paperMap[current]?.parentId; }
      return false;
    }
    final paperRelationships = !_paperFirst || selected == null ? <GraphRelation>[] : widget.data.paperRelations.where((r) => r.type != 'contains' && _enabledFilters.contains(r.type) && (belongs(r.from, selected.id) || belongs(r.to, selected.id))).toList();
    final mediaWidth = MediaQuery.sizeOf(context).width;

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
                        zoom: (_camera.zoom *
                                math.exp(-event.scrollDelta.dy * .001))
                            .clamp(.32, 3.2)
                            .toDouble(),
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
                            zoom: (_gestureZoom * details.scale)
                                .clamp(.32, 3.2)
                                .toDouble(),
                            panX: _camera.panX + delta.dx,
                            panY: _camera.panY + delta.dy,
                          );
                        } else {
                          _camera = _camera.copyWith(
                            yaw: _camera.yaw + delta.dx * .008,
                            pitch: (_camera.pitch + delta.dy * .008)
                                .clamp(-1.28, 1.28)
                                .toDouble(),
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
                        changedEntityIds: widget.changedEntityIds,
                        impactedTopicIds: widget.impactedTopicIds,
                        changeAnimationsEnabled: widget.changeAnimationsEnabled,
                        runningVerification: widget.runningVerificationTargetIds,
                        passedVerification: widget.passedVerificationTargetIds,
                        failedVerification: widget.failedVerificationTargetIds,
                        activityNodeId: widget.activityNodeId,
                        activityPulse: _activityPulse,
                        historicalEntityIds: widget.historicalEntityIds,
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
                const Text('ResearchWorkspace',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                Text('3D Research Graph · ' + widget.data.snapshotDate,
                    style: const TextStyle(color: Color(0xFF8FA5BD), fontSize: 11)),
                const SizedBox(height: 10),
                Wrap(spacing: 7, runSpacing: 7, children: [
                  FilledButton.tonal(onPressed: _reset, child: const Text('總覽')),
                  FilledButton.tonal(onPressed: () => setState(() { _paperFirst = !_paperFirst; _expanded.clear(); _selectedId = null; }), child: Text(_paperFirst ? '研究治理視圖' : '論文視圖')),
                  FilledButton.tonal(onPressed: _expandAll, child: const Text('全展開')),
                ]),
                const SizedBox(height: 8),
                Text(
                  widget.data.paperNodes.isNotEmpty ? '${widget.data.paperNodes.where((n) => n.kind == 'paper').length} 論文 · 論點 → 方法／資料 → 結果' : widget.data.topics.length.toString() + ' topics · ' +
                      widget.data.claims.length.toString() + ' claims · ' +
                      widget.data.evidence.length.toString() + ' evidence',
                  style: const TextStyle(fontSize: 11, color: Color(0xFFBDD0E5)),
                ),
              ],
            ),
          ),
        ),
        FloatingPanel(
          title: 'Research Relations',
          icon: Icons.tune,
          dock: _controlsDock,
          collapsed: _controlsCollapsed,
          width: math.min(360, mediaWidth - 24),
          expandedHeight: 300,
          onCollapsedChanged: (value) =>
              setState(() => _controlsCollapsed = value),
          onDockChanged: (value) => setState(() => _controlsDock = value),
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 6),
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Wrap(spacing: 7, children: [
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
                ]),
              ),
              for (final key in edgeFilterKeys)
                CheckboxListTile(
                  dense: true,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: _enabledFilters.contains(key),
                  title: Text(edgeFilterLabels[key] ?? key,
                      style: const TextStyle(fontSize: 11)),
                  subtitle: Text(key,
                      style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 9,
                          color: Color(0xFF7890A8))),
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
            expandedHeight:
                math.max(180, MediaQuery.sizeOf(context).height - 96),
            onCollapsedChanged: (value) =>
                setState(() => _detailsCollapsed = value),
            onDockChanged: (value) => setState(() => _detailsDock = value),
            onClose: () => setState(() => _selectedId = null),
            child: ListView(
              padding: const EdgeInsets.all(14),
              shrinkWrap: true,
              children: [
                Text(selected.kind.toUpperCase(),
                    style: const TextStyle(
                        color: Color(0xFF67E8F9),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2)),
                const SizedBox(height: 5),
                Text(selected.label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 8),
                CollapsibleMessage(
                    text: selected.summary,
                    style: const TextStyle(
                        color: Color(0xFFB8C9DA), height: 1.5)),
                if (selected.status != null)
                  _InfoItem('STATUS · ' + selected.status!),
                if (selected.detail != null) _InfoItem(selected.detail!),
                const SizedBox(height: 14),
                if (paperMap.containsKey(selected.id)) ...[
                  const _SectionTitle('對應關係與雙方定位'),
                  for (final warning in widget.data.paperWarnings) _InfoItem(warning),
                  if (paperRelationships.isEmpty) const _InfoItem('此節點尚無已登錄的對應關係'),
                  _InfoItem('綠：較佳 · 粉紅：較差 · 黃：持平 · 灰：不可直接比較'),
                  for (final r in paperRelationships.take(_relationshipLimit)) ListTile(
                    dense: true,
                    title: Text(r.label, style: const TextStyle(fontSize:12)),
                    subtitle: Text('${paperMap[r.from]?.label ?? r.from} → ${paperMap[r.to]?.label ?? r.to}\n${r.provenance}', style:const TextStyle(fontSize:10)),
                    trailing: const Icon(Icons.travel_explore, size:18),
                    onTap: () => setState(() {
                      for (final id in [r.from,r.to]) {
                        String? current=paperMap[id]?.parentId;
                        while(current!=null) { _expanded.add(current); current=paperMap[current]?.parentId; }
                      }
                      _selectedId=r.to;
                    }),
                  ),
                  if (paperRelationships.length > _relationshipLimit) TextButton(onPressed: () => setState(() => _relationshipLimit += 40), child: Text('再顯示 40 條（共 ${paperRelationships.length} 條）')),
                ],
                const _SectionTitle('Visible relationships'),
                if (relationships.isEmpty)
                  const _InfoItem('No visible relationship under current filters'),
                for (final edge in relationships)
                  _InfoItem(edge.type +
                      ' · ' +
                      edge.from +
                      ' → ' +
                      edge.to +
                      '\n' +
                      edge.label),
                const SizedBox(height: 12),
                Text(
                  widget.data.paperNodes.any((n) => n.parentId == selected.id) || selected.kind == 'topic' ||
                          selected.kind == 'claim' ||
                          selected.kind == 'source-area'
                      ? (_visibleExpanded.contains(selected.id)
                          ? 'Expanded semantic cluster'
                          : 'Tap again to expand semantic cluster')
                      : 'Evidence-level node',
                  style:
                      const TextStyle(color: Color(0xFF8FA5BD), fontSize: 11),
                ),
              ],
            ),
          ),
        Positioned(
          left: 12,
          bottom: 12,
          child: _Panel(
            child: const Text(
              '左鍵/一指拖曳旋轉 · 右鍵拖曳平移 · 兩指縮放＋平移 · 滾輪縮放 · 方向鍵選取 · Enter 展開',
              style: TextStyle(fontSize: 11, color: Color(0xFFA9BDD0)),
            ),
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: Color(0xFF93C5FD),
        fontSize: 11,
        letterSpacing: 1.1,
        fontWeight: FontWeight.w700,
      ),
    ),
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


class _GraphPainter extends CustomPainter {
  const _GraphPainter({
    required this.scene,
    required this.camera,
    required this.selectedId,
    required this.changedEntityIds,
    required this.impactedTopicIds,
    required this.changeAnimationsEnabled,
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
  final bool changeAnimationsEnabled;
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

    final byId = scene.byId;
    final projected = {for (final n in scene.nodes) n.id: camera.project(n.position, size)};
    final selectedNode = byId[selectedId];
    final spotlightId = selectedNode?.isChild == true ? selectedId : null;
    final connected = <String>{};
    final relatedOwners = <String>{};
    if (spotlightId != null) {
      connected.add(spotlightId);
      for (final edge in scene.edges) {
        if (edge.from != spotlightId && edge.to != spotlightId) continue;
        final other = edge.from == spotlightId ? edge.to : edge.from;
        connected.add(other);
        final owner = byId[other]?.ownerId;
        if (owner != null) relatedOwners.add(owner);
      }
    }
    final spotlightOwner = spotlightId == null ? null : byId[spotlightId]?.ownerId;

    for (final cluster in scene.clusters) {
      if (historicalEntityIds.isNotEmpty && !historicalEntityIds.contains(cluster.ownerId)) continue;
      final p = projected[cluster.ownerId];
      if (p == null) continue;
      final r = math.max(42.0, cluster.radius * p.scale);
      final clusterActive = spotlightId == null ||
          cluster.ownerId == spotlightOwner ||
          relatedOwners.contains(cluster.ownerId);
      canvas.drawOval(
        Rect.fromCenter(center: p.offset, width: r * 1.6, height: r * .56),
        Paint()
          ..color = const Color(0xFF60A5FA).withValues(alpha: clusterActive ? .18 : .035)
          ..style = PaintingStyle.stroke,
      );
    }

    for (final edge in scene.edges) {
      if (historicalEntityIds.isNotEmpty && (!historicalEntityIds.contains(edge.from) || !historicalEntityIds.contains(edge.to))) continue;
      final a = projected[edge.from];
      final b = projected[edge.to];
      if (a == null || b == null) continue;
      final incident = spotlightId == null || edge.from == spotlightId || edge.to == spotlightId;
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
          : edge.outcome == 'BETTER' ? const Color(0xFF4ADE80) : edge.outcome == 'WORSE' ? const Color(0xFFFB7185) : edge.outcome == 'TIE' ? const Color(0xFFFACC15) : edge.outcome == 'NOT_COMPARABLE' ? const Color(0xFF94A3B8) : _edgeColor(edge.type);
      final changePulse = changeAnimationsEnabled
          ? (math.sin(activityPulse.value * math.pi * 2) + 1) * .5
          : .5;
      canvas.drawLine(
        a.offset,
        b.offset,
        Paint()
          ..color = color.withValues(alpha: changed ? .70 + changePulse * .27 : incident ? .72 : .07)
          ..strokeWidth = changed ? 2.5 + changePulse * 1.6 : vStatus != null && edge.type == 'validated-by' ? 2.5 : incident ? 1.7 : .8,
      );
    }

    final ordered = [...scene.nodes]
      ..sort((a, b) => projected[a.id]!.depth.compareTo(projected[b.id]!.depth));
    for (final node in ordered) {
      if (historicalEntityIds.isNotEmpty && !historicalEntityIds.contains(node.id)) continue;
      final p = projected[node.id]!;
      final selected = node.id == selectedId;
      final base = node.kind == 'root' ? 18.0 : (node.kind == 'topic' || node.kind == 'paper') ? 13.0 : node.kind == 'claim' ? 8.0 : 5.8;
      final radius = math.max(node.isChild ? 4.5 : 8.0, base * p.scale);
      final color = _nodeColor(node);
      final spotlightVisible = spotlightId == null ||
          connected.contains(node.id) ||
          node.id == spotlightOwner ||
          relatedOwners.contains(node.id) ||
          (node.ownerId != null && relatedOwners.contains(node.ownerId));
      canvas.saveLayer(
        Rect.fromCircle(center: p.offset, radius: radius + 260),
        Paint()..color = Colors.white.withValues(alpha: spotlightVisible ? 1 : .14),
      );

      final changePulse = changeAnimationsEnabled
          ? (math.sin(activityPulse.value * math.pi * 2) + 1) * .5
          : .5;
      if (node.kind == 'topic' && impactedTopicIds.contains(node.id)) {
        _ring(canvas, p.offset, radius + 12 + changePulse * 4, const Color(0xFFA78BFA), 2.2 + changePulse);
      }
      if (changedEntityIds.contains(node.id)) {
        _ring(canvas, p.offset, radius + 9 + changePulse * 5, const Color(0xFFFBBF24), 2.1 + changePulse * 1.2);
      }
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
      canvas.restore();
    }
  }

  void _ring(Canvas canvas, Offset center, double radius, Color color, double width) {
    canvas.drawCircle(center, radius, Paint()..color = color.withValues(alpha: .9)..style = PaintingStyle.stroke..strokeWidth = width);
  }

  Color _nodeColor(VisualNode node) => switch (node.kind) {
    'root' => const Color(0xFF67E8F9),
    'paper' => const Color(0xFF60A5FA),
    'point' => const Color(0xFFFBBF24),
    'method' => const Color(0xFFA78BFA),
    'dataset' => const Color(0xFF22D3EE),
    'experiment' => const Color(0xFFFB923C),
    'result' => const Color(0xFFA7F3D0),
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
    'cites' => const Color(0xFF60A5FA),
    'compares' => const Color(0xFFF59E0B),
    'argues' => const Color(0xFFA78BFA),
    'uses-data' => const Color(0xFF22D3EE),
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

