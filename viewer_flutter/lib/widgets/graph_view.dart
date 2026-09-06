import 'dart:math' as math;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
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

  GraphScene get _scene => buildGraphScene(widget.data, expanded: _expanded);

  void _reset() => setState(() {
    _camera = const Camera3d();
    _expanded.clear();
    _selectedId = null;
  });

  void _expandAll() => setState(() {
    _expanded
      ..clear()
      ..addAll(widget.data.topics.map((x) => x.id))
      ..addAll(widget.data.claims.map((x) => x.id));
    _camera = _camera.copyWith(zoom: .58, panX: 0, panY: 0);
  });

  void _activate(String id) {
    final node = _scene.byId[id];
    if (node == null) return;
    setState(() {
      _selectedId = id;
      if (node.kind == 'topic' || node.kind == 'claim') {
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

  @override
  Widget build(BuildContext context) {
    final scene = _scene;
    final selected = scene.byId[_selectedId];
    final mediaWidth = MediaQuery.sizeOf(context).width;

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
                    painter: _GraphPainter(scene: scene, camera: _camera, selectedId: _selectedId),
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
                ]),
                const SizedBox(height: 8),
                Text(
                  widget.data.topics.length.toString() + ' topics · ' +
                  widget.data.claims.length.toString() + ' claims · ' +
                  widget.data.evidence.length.toString() + ' evidence',
                  style: const TextStyle(fontSize: 11, color: Color(0xFFBDD0E5)),
                ),
              ],
            ),
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
                    if (selected.status != null) ...[
                      const SizedBox(height: 12),
                      _InfoItem('STATUS · ' + selected.status!),
                    ],
                    if (selected.detail != null) _InfoItem(selected.detail!),
                    const SizedBox(height: 12),
                    Text(
                      selected.kind == 'topic' || selected.kind == 'claim'
                        ? (_expanded.contains(selected.id) ? 'Expanded semantic cluster' : 'Tap again to expand semantic cluster')
                        : 'Evidence-level node',
                      style: const TextStyle(color: Color(0xFF8FA5BD), fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),
          ),
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
    constraints: const BoxConstraints(maxWidth: 470),
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

class _GraphPainter extends CustomPainter {
  const _GraphPainter({required this.scene, required this.camera, required this.selectedId});
  final GraphScene scene;
  final Camera3d camera;
  final String? selectedId;

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
      final a = projected[edge.from];
      final b = projected[edge.to];
      if (a == null || b == null) continue;
      final color = _edgeColor(edge.type);
      canvas.drawLine(
        a.offset,
        b.offset,
        Paint()
          ..color = color.withValues(alpha: .58)
          ..strokeWidth = 1.4,
      );
    }

    final ordered = [...scene.nodes]
      ..sort((a, b) => projected[a.id]!.depth.compareTo(projected[b.id]!.depth));
    for (final node in ordered) {
      final p = projected[node.id]!;
      final selected = node.id == selectedId;
      final base = node.kind == 'root' ? 18.0 : node.kind == 'topic' ? 13.0 : node.kind == 'claim' ? 8.0 : 5.8;
      final radius = math.max(node.isChild ? 4.5 : 8.0, base * p.scale);
      final color = _nodeColor(node);
      if (selected) {
        canvas.drawCircle(
          p.offset,
          radius + 7,
          Paint()
            ..color = Colors.white.withValues(alpha: .92)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.4,
        );
      }
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

  Color _nodeColor(VisualNode node) => switch (node.kind) {
    'root' => const Color(0xFF67E8F9),
    'topic' => const Color(0xFF60A5FA),
    'claim' when node.status == 'NOT_SUPPORTED' => const Color(0xFFFB7185),
    'claim' when node.status == 'PARTIAL' => const Color(0xFFF59E0B),
    'claim' => const Color(0xFFFBBF24),
    'study' => const Color(0xFFA78BFA),
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

  @override
  bool shouldRepaint(covariant _GraphPainter oldDelegate) => true;
}
