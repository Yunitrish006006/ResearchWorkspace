import 'dart:math' as math;
import 'dart:ui';
import 'graph_data.dart';

class Vec3 {
  const Vec3(this.x, this.y, this.z);
  final double x;
  final double y;
  final double z;
}

class ProjectedPoint {
  const ProjectedPoint({required this.offset, required this.scale, required this.depth});
  final Offset offset;
  final double scale;
  final double depth;
}

class Camera3d {
  const Camera3d({this.yaw = -0.48, this.pitch = 0.22, this.zoom = 1.02, this.panX = 0, this.panY = 0});
  final double yaw;
  final double pitch;
  final double zoom;
  final double panX;
  final double panY;

  Camera3d copyWith({double? yaw, double? pitch, double? zoom, double? panX, double? panY}) =>
      Camera3d(yaw: yaw ?? this.yaw, pitch: pitch ?? this.pitch, zoom: zoom ?? this.zoom, panX: panX ?? this.panX, panY: panY ?? this.panY);

  ProjectedPoint project(Vec3 point, Size size) {
    final cy = math.cos(yaw);
    final sy = math.sin(yaw);
    final cp = math.cos(pitch);
    final sp = math.sin(pitch);
    final x = point.x * cy - point.z * sy;
    var z = point.x * sy + point.z * cy;
    final y = point.y * cp - z * sp;
    z = point.y * sp + z * cp;
    final scale = zoom * 820 / math.max(200, 920 + z);
    return ProjectedPoint(
      offset: Offset(size.width / 2 + panX + x * scale, size.height / 2 + panY + y * scale),
      scale: scale,
      depth: z,
    );
  }
}

class VisualNode {
  const VisualNode({
    required this.id,
    required this.kind,
    required this.label,
    required this.summary,
    required this.position,
    this.ownerId,
    this.status,
    this.detail,
  });
  final String id;
  final String kind;
  final String label;
  final String summary;
  final Vec3 position;
  final String? ownerId;
  final String? status;
  final String? detail;
  bool get isChild => kind != 'root' && kind != 'topic';
}

class VisualEdge {
  const VisualEdge({required this.id, required this.from, required this.to, required this.type, required this.label});
  final String id;
  final String from;
  final String to;
  final String type;
  final String label;
}

class VisualCluster {
  const VisualCluster({required this.ownerId, required this.radius, required this.childCount});
  final String ownerId;
  final double radius;
  final int childCount;
}

class GraphScene {
  const GraphScene({required this.nodes, required this.edges, required this.clusters});
  final List<VisualNode> nodes;
  final List<VisualEdge> edges;
  final List<VisualCluster> clusters;
  Map<String, VisualNode> get byId => {for (final node in nodes) node.id: node};
}

double _hashUnit(String value, int salt) {
  var hash = (2166136261 ^ salt) & 0xffffffff;
  for (final unit in value.codeUnits) {
    hash ^= unit;
    hash = (hash * 16777619) & 0xffffffff;
  }
  hash ^= hash >> 16;
  hash = (hash * 2246822507) & 0xffffffff;
  hash ^= hash >> 13;
  return (hash & 0xffffffff) / 4294967295;
}

Vec3 _fib(int index, int count, double radius) {
  final y = 1 - 2 * ((index + 0.5) / math.max(1, count));
  final ring = math.sqrt(math.max(0, 1 - y * y));
  final theta = index * math.pi * (3 - math.sqrt(5));
  return Vec3(math.cos(theta) * ring * radius, y * radius, math.sin(theta) * ring * radius);
}

Vec3 _scatter(Vec3 parent, String id, String kind, double radius) {
  final u = _hashUnit(id, 17);
  final v = _hashUnit(id, 53);
  final q = _hashUnit(id, 97);
  final z = 2 * u - 1;
  final ring = math.sqrt(math.max(0, 1 - z * z));
  final theta = 2 * math.pi * v;
  final minBand = kind == 'claim' ? .56 : kind == 'study' ? .42 : kind == 'evidence' ? .52 : .58;
  final maxBand = kind == 'claim' ? .90 : kind == 'study' ? .72 : kind == 'evidence' ? .84 : .88;
  final rr = radius * (minBand + (maxBand - minBand) * q);
  return Vec3(parent.x + ring * math.cos(theta) * rr, parent.y + z * rr, parent.z + ring * math.sin(theta) * rr);
}

VisualNode? _firstNode(Iterable<VisualNode> nodes) => nodes.isEmpty ? null : nodes.first;

GraphScene buildGraphScene(GraphData data, {Set<String> expanded = const {}}) {
  final nodes = <VisualNode>[
    VisualNode(id: data.root.id, kind: 'root', label: data.root.name, summary: data.root.summary, position: const Vec3(0, 0, 0)),
  ];
  final edges = <VisualEdge>[];
  final clusters = <VisualCluster>[];

  final expandedTopics = data.topics.where((x) => expanded.contains(x.id)).length;
  final topicRadius = expandedTopics == 0 ? 340.0 : math.min(610.0, 430 + math.sqrt(expandedTopics) * 46);

  for (var i = 0; i < data.topics.length; i++) {
    final topic = data.topics[i];
    final position = _fib(i, data.topics.length, topicRadius);
    nodes.add(VisualNode(id: topic.id, kind: 'topic', label: topic.name, summary: topic.summary, position: position, ownerId: data.root.id));
    edges.add(VisualEdge(id: 'contains:' + topic.id, from: data.root.id, to: topic.id, type: 'contains', label: 'contains'));
  }

  for (final topic in data.topics) {
    if (!expanded.contains(topic.id)) continue;
    final parent = nodes.firstWhere((x) => x.id == topic.id);
    final owned = data.claims.where((x) => x.ownerId == topic.id).toList(growable: false);
    final radius = math.min(230.0, 105 + math.sqrt(math.max(1, owned.length)) * 30);
    clusters.add(VisualCluster(ownerId: topic.id, radius: radius, childCount: owned.length));
    for (final claim in owned) {
      nodes.add(VisualNode(
        id: claim.id,
        kind: 'claim',
        label: claim.title,
        summary: claim.summary,
        position: _scatter(parent.position, claim.id, 'claim', radius),
        ownerId: topic.id,
        status: claim.status,
      ));
      edges.add(VisualEdge(id: 'claim:' + claim.id, from: topic.id, to: claim.id, type: 'contains', label: 'claim'));
    }
  }

  for (final claim in data.claims) {
    if (!expanded.contains(claim.id)) continue;
    final parent = _firstNode(nodes.where((x) => x.id == claim.id));
    if (parent == null) continue;
    final studies = data.studies.where((x) => x.claimId == claim.id).toList();
    final evidence = data.evidence.where((x) => x.claimId == claim.id).toList();
    final reviews = data.reviews.where((x) => x.claimId == claim.id).toList();
    final count = studies.length + evidence.length + reviews.length;
    final radius = math.min(170.0, 76 + math.sqrt(math.max(1, count)) * 23);
    clusters.add(VisualCluster(ownerId: claim.id, radius: radius, childCount: count));

    for (final item in studies) {
      nodes.add(VisualNode(
        id: item.id,
        kind: 'study',
        label: item.title,
        summary: item.summary,
        position: _scatter(parent.position, item.id, 'study', radius),
        ownerId: claim.id,
        detail: item.kind,
      ));
      edges.add(VisualEdge(id: 'study:' + item.id, from: claim.id, to: item.id, type: 'uses-method', label: item.kind));
    }
    for (final item in evidence) {
      nodes.add(VisualNode(
        id: item.id,
        kind: 'evidence',
        label: item.title,
        summary: item.summary,
        position: _scatter(parent.position, item.id, 'evidence', radius),
        ownerId: claim.id,
        detail: item.evidenceClass + ' · ' + item.path,
      ));
      edges.add(VisualEdge(id: 'evidence:' + item.id, from: item.id, to: claim.id, type: 'supports', label: item.evidenceClass));
    }
    for (final item in reviews) {
      nodes.add(VisualNode(
        id: item.id,
        kind: 'review',
        label: item.title,
        summary: item.summary,
        position: _scatter(parent.position, item.id, 'review', radius),
        ownerId: claim.id,
        status: item.status,
      ));
      edges.add(VisualEdge(id: 'review:' + item.id, from: claim.id, to: item.id, type: 'validated-by', label: item.status));
    }
  }

  final ids = nodes.map((x) => x.id).toSet();
  for (final rel in data.relations) {
    if (ids.contains(rel.from) && ids.contains(rel.to)) {
      edges.add(VisualEdge(id: rel.id, from: rel.from, to: rel.to, type: rel.type, label: rel.label));
    }
  }
  return GraphScene(nodes: List.unmodifiable(nodes), edges: List.unmodifiable(edges), clusters: List.unmodifiable(clusters));
}
