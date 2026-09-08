import 'dart:math' as math;
import 'dart:ui';
import 'graph_data.dart';

const edgeFilterKeys = <String>[
  'cites',
  'compares',
  'argues',
  'uses-data',
  'supports',
  'uses-method',
  'grounded-in',
  'validated-by',
  'limits',
];

const edgeFilterLabels = <String, String>{
  'cites': '引用',
  'compares': '比較（較佳／較差／持平／不可比）',
  'argues': '論證依據',
  'uses-data': '使用資料集',
  'supports': 'Evidence supports',
  'uses-method': 'Uses method',
  'grounded-in': 'Grounded in',
  'validated-by': 'Validated by',
  'limits': 'Limits / boundary',
};

class Vec3 {
  const Vec3(this.x, this.y, this.z);
  static const zero = Vec3(0, 0, 0);
  final double x;
  final double y;
  final double z;

  Vec3 operator +(Vec3 other) => Vec3(x + other.x, y + other.y, z + other.z);
  Vec3 operator -(Vec3 other) => Vec3(x - other.x, y - other.y, z - other.z);
  Vec3 operator *(double value) => Vec3(x * value, y * value, z * value);
  double get length => math.sqrt(x * x + y * y + z * z);
  Vec3 get normalized => length < .000001 ? zero : this * (1 / length);
  double dot(Vec3 other) => x * other.x + y * other.y + z * other.z;
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
  bool get isChild => kind != 'root' && kind != 'topic' && kind != 'paper';
}

class VisualEdge {
  const VisualEdge({required this.id, required this.from, required this.to, required this.type, required this.label, this.outcome});
  final String? outcome;
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

class _RelationHint {
  const _RelationHint(this.targetTopicId, this.weight);
  final String targetTopicId;
  final double weight;
}

String? _topicForEntity(GraphData data, String id) {
  if (data.topics.any((x) => x.id == id)) return id;
  for (final claim in data.claims) {
    if (claim.id == id) return claim.ownerId;
  }
  for (final study in data.studies) {
    if (study.id == id) {
      for (final claim in data.claims) {
        if (claim.id == study.claimId) return claim.ownerId;
      }
    }
  }
  for (final evidence in data.evidence) {
    if (evidence.id == id) {
      for (final claim in data.claims) {
        if (claim.id == evidence.claimId) return claim.ownerId;
      }
    }
  }
  for (final review in data.reviews) {
    if (review.id == id) {
      for (final claim in data.claims) {
        if (claim.id == review.claimId) return claim.ownerId;
      }
    }
  }
  for (final area in data.sourceAreas) {
    if (area.id == id) {
      for (final claim in data.claims) {
        if (claim.id == area.claimId) return claim.ownerId;
      }
    }
  }
  return null;
}

double _relationWeight(String type) => switch (type) {
  'grounded-in' => 1.45,
  'supports' => 1.30,
  'validated-by' => 1.20,
  'uses-method' => 1.05,
  'limits' => .90,
  _ => .70,
};

List<_RelationHint> _claimRelationHints(GraphData data, GraphClaim claim) {
  final hints = <_RelationHint>[];
  for (final relation in data.relations) {
    String? other;
    if (relation.from == claim.id) other = relation.to;
    if (relation.to == claim.id) other = relation.from;
    if (other == null) continue;
    final topicId = _topicForEntity(data, other);
    if (topicId == null || topicId == claim.ownerId) continue;
    hints.add(_RelationHint(topicId, _relationWeight(relation.type)));
  }
  return hints;
}

Vec3 _relationAwareScatter(
  Vec3 parent,
  String id,
  String kind,
  double radius,
  Map<String, Vec3> topicAnchors,
  List<_RelationHint> hints,
) {
  final base = _scatter(parent, id, kind, radius);
  if (hints.isEmpty) return base;

  var target = Vec3.zero;
  var totalWeight = 0.0;
  for (final hint in hints) {
    final anchor = topicAnchors[hint.targetTopicId];
    if (anchor == null) continue;
    target = target + (anchor - parent).normalized * hint.weight;
    totalWeight += hint.weight;
  }
  if (totalWeight <= 0 || target.length < .000001) return base;

  final baseOffset = base - parent;
  final desired = target.normalized * (radius * .82);
  return parent + baseOffset * .55 + desired * .45;
}

GraphScene buildGraphScene(
  GraphData data, {
  Set<String> expanded = const {},
  bool paperFirst = true,
  Set<String> enabledFilters = const {
    'cites', 'compares', 'argues', 'uses-data',
    'supports',
    'uses-method',
    'grounded-in',
    'validated-by',
    'limits',
  },
}) {
  if (paperFirst && data.paperNodes.isNotEmpty) return buildPaperScene(data, expanded: expanded, enabledFilters: enabledFilters);
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

  final topicAnchors = {
    for (final node in nodes)
      if (node.kind == 'topic') node.id: node.position,
  };

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
        position: _relationAwareScatter(
          parent.position,
          claim.id,
          'claim',
          radius,
          topicAnchors,
          _claimRelationHints(data, claim),
        ),
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
    final sourceAreas = data.sourceAreas.where((x) => x.claimId == claim.id).toList();
    final count = studies.length + evidence.length + reviews.length + sourceAreas.length;
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
      if (enabledFilters.contains('uses-method')) {
        edges.add(VisualEdge(id: 'study:' + item.id, from: claim.id, to: item.id, type: 'uses-method', label: item.kind));
      }
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
      if (enabledFilters.contains('supports')) {
        edges.add(VisualEdge(id: 'evidence:' + item.id, from: item.id, to: claim.id, type: 'supports', label: item.evidenceClass));
      }
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
      if (enabledFilters.contains('validated-by')) {
        edges.add(VisualEdge(id: 'review:' + item.id, from: claim.id, to: item.id, type: 'validated-by', label: item.status));
      }
    }
    for (final area in sourceAreas) {
      nodes.add(VisualNode(
        id: area.id,
        kind: 'source-area',
        label: area.title,
        summary: area.summary,
        position: _scatter(parent.position, area.id, 'source-area', radius),
        ownerId: claim.id,
        detail: area.artifactIds.length.toString() + ' indexed artifacts · ' + area.family,
      ));
      edges.add(VisualEdge(id: 'source-area:' + area.id, from: claim.id, to: area.id, type: 'contains', label: 'source area'));
    }
  }

  for (final area in data.sourceAreas) {
    if (!expanded.contains(area.id)) continue;
    final parent = _firstNode(nodes.where((x) => x.id == area.id));
    if (parent == null) continue;
    final artifacts = data.artifacts.where((x) => x.areaId == area.id).toList();
    final radius = math.min(135.0, 62 + math.sqrt(math.max(1, artifacts.length)) * 20);
    clusters.add(VisualCluster(ownerId: area.id, radius: radius, childCount: artifacts.length));
    for (final artifact in artifacts) {
      final sha = artifact.sha256 == null ? '' : artifact.sha256!.substring(0, math.min(10, artifact.sha256!.length));
      nodes.add(VisualNode(
        id: artifact.id,
        kind: 'artifact',
        label: artifact.title,
        summary: artifact.summary,
        position: _scatter(parent.position, artifact.id, 'artifact', radius),
        ownerId: area.id,
        detail: artifact.path + ' · confidence ' + artifact.mappingConfidence.toStringAsFixed(2) + (sha.isEmpty ? '' : ' · sha ' + sha),
      ));
      edges.add(VisualEdge(id: 'artifact:' + artifact.id, from: area.id, to: artifact.id, type: 'contains', label: 'indexed source'));
    }
  }

  final ids = nodes.map((x) => x.id).toSet();
  for (final rel in data.relations) {
    final hierarchy = rel.type == 'contains' || rel.type == 'detail';
    if (ids.contains(rel.from) && ids.contains(rel.to) && (hierarchy || enabledFilters.contains(rel.type))) {
      edges.add(VisualEdge(id: rel.id, from: rel.from, to: rel.to, type: rel.type, label: rel.label));
    }
  }
  return GraphScene(nodes: List.unmodifiable(nodes), edges: List.unmodifiable(edges), clusters: List.unmodifiable(clusters));
}

GraphScene buildPaperScene(GraphData data, {Set<String> expanded = const {}, Set<String> enabledFilters = const {'cites', 'compares', 'argues', 'uses-method', 'uses-data'}}) {
  final all = {for (final n in data.paperNodes) n.id: n};
  final children = <String, List<PaperNode>>{};
  for (final n in data.paperNodes) {
    if (n.parentId != null) (children[n.parentId!] ??= []).add(n);
  }
  final nodes = <VisualNode>[];
  final clusters = <VisualCluster>[];
  void visit(PaperNode n, Vec3 position, int depth) {
    nodes.add(VisualNode(id:n.id, kind:n.kind, label:n.label, summary:n.summary, position:position, ownerId:n.parentId, status:n.status, detail:n.detail));
    if (!expanded.contains(n.id)) return;
    final owned = children[n.id] ?? const <PaperNode>[];
    final radius = math.max(48.0, 230.0 / (depth + 1));
    if (owned.isNotEmpty) clusters.add(VisualCluster(ownerId:n.id,radius:radius,childCount:owned.length));
    for (var i=0;i<owned.length;i++) { visit(owned[i],position + _fib(i,owned.length,radius),depth+1); }
  }
  final papers=data.paperNodes.where((n)=>n.parentId==null).toList();
  for(var i=0;i<papers.length;i++) {
    visit(papers[i],i==0?Vec3.zero:_fib(i-1,papers.length-1,360),0);
  }
  final visible=nodes.map((n)=>n.id).toSet();
  String? ancestor(String id) {
    final seen=<String>{};
    String? current=id;
    while(current!=null && seen.add(current)) {
      if(visible.contains(current)) return current;
      current=all[current]?.parentId;
    }
    return null;
  }
  final edges=<VisualEdge>[];
  final emitted=<String>{};
  for(final r in data.paperRelations) {
    if(r.type!='contains' && !enabledFilters.contains(r.type)) continue;
    final from=ancestor(r.from),to=ancestor(r.to);
    if(from==null||to==null||from==to) continue;
    final key='$from|$to|${r.type}|${r.outcome}';
    if(!emitted.add(key)) continue;
    edges.add(VisualEdge(id:r.id,from:from,to:to,type:r.type,label:r.label,outcome:r.outcome));
  }
  return GraphScene(nodes:nodes,edges:edges,clusters:clusters);
}
