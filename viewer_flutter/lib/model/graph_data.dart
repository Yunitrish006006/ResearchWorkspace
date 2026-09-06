class GraphData {
  const GraphData({
    required this.snapshotDate,
    required this.root,
    required this.topics,
    required this.claims,
    required this.studies,
    required this.evidence,
    required this.reviews,
    required this.relations,
  });

  final String snapshotDate;
  final GraphRoot root;
  final List<GraphTopic> topics;
  final List<GraphClaim> claims;
  final List<GraphStudy> studies;
  final List<GraphEvidence> evidence;
  final List<GraphReview> reviews;
  final List<GraphRelation> relations;

  factory GraphData.fromJson(Map<String, dynamic> json) {
    final snapshot = Map<String, dynamic>.from(json['snapshot'] as Map? ?? const {});
    return GraphData(
      snapshotDate: snapshot['date'] as String? ?? 'unknown',
      root: GraphRoot.fromJson(Map<String, dynamic>.from(json['root'] as Map? ?? const {})),
      topics: _objects(json['topics']).map(GraphTopic.fromJson).toList(growable: false),
      claims: _objects(json['claims']).map(GraphClaim.fromJson).toList(growable: false),
      studies: _objects(json['studies']).map(GraphStudy.fromJson).toList(growable: false),
      evidence: _objects(json['evidence']).map(GraphEvidence.fromJson).toList(growable: false),
      reviews: _objects(json['reviews']).map(GraphReview.fromJson).toList(growable: false),
      relations: _objects(json['relations']).map(GraphRelation.fromJson).toList(growable: false),
    );
  }

  static Iterable<Map<String, dynamic>> _objects(Object? value) {
    if (value is! List) return const <Map<String, dynamic>>[];
    return value.whereType<Map>().map((x) => Map<String, dynamic>.from(x));
  }
}

class GraphRoot {
  const GraphRoot({required this.id, required this.name, required this.summary});
  final String id;
  final String name;
  final String summary;
  factory GraphRoot.fromJson(Map<String, dynamic> json) => GraphRoot(
    id: json['id'] as String? ?? 'thesis',
    name: json['name'] as String? ?? 'Research',
    summary: json['summary'] as String? ?? '',
  );
}

class GraphTopic {
  const GraphTopic({required this.id, required this.name, required this.summary, required this.rankHint});
  final String id;
  final String name;
  final String summary;
  final int rankHint;
  factory GraphTopic.fromJson(Map<String, dynamic> json) => GraphTopic(
    id: json['id'] as String? ?? '',
    name: json['name'] as String? ?? '',
    summary: json['summary'] as String? ?? '',
    rankHint: (json['rankHint'] as num?)?.toInt() ?? 2,
  );
}

class GraphClaim {
  const GraphClaim({required this.id, required this.ownerId, required this.title, required this.summary, required this.status});
  final String id;
  final String ownerId;
  final String title;
  final String summary;
  final String status;
  factory GraphClaim.fromJson(Map<String, dynamic> json) => GraphClaim(
    id: json['id'] as String? ?? '',
    ownerId: json['ownerId'] as String? ?? '',
    title: json['title'] as String? ?? '',
    summary: json['summary'] as String? ?? '',
    status: json['status'] as String? ?? 'UNKNOWN',
  );
}

class GraphStudy {
  const GraphStudy({required this.id, required this.claimId, required this.title, required this.kind, required this.summary});
  final String id;
  final String claimId;
  final String title;
  final String kind;
  final String summary;
  factory GraphStudy.fromJson(Map<String, dynamic> json) => GraphStudy(
    id: json['id'] as String? ?? '',
    claimId: json['claimId'] as String? ?? '',
    title: json['title'] as String? ?? '',
    kind: json['kind'] as String? ?? 'STUDY',
    summary: json['summary'] as String? ?? '',
  );
}

class GraphEvidence {
  const GraphEvidence({required this.id, required this.claimId, required this.title, required this.summary, required this.path, required this.evidenceClass});
  final String id;
  final String claimId;
  final String title;
  final String summary;
  final String path;
  final String evidenceClass;
  factory GraphEvidence.fromJson(Map<String, dynamic> json) => GraphEvidence(
    id: json['id'] as String? ?? '',
    claimId: json['claimId'] as String? ?? '',
    title: json['title'] as String? ?? '',
    summary: json['summary'] as String? ?? '',
    path: json['path'] as String? ?? '',
    evidenceClass: json['evidenceClass'] as String? ?? 'evidence',
  );
}

class GraphReview {
  const GraphReview({required this.id, required this.claimId, required this.title, required this.summary, required this.status});
  final String id;
  final String claimId;
  final String title;
  final String summary;
  final String status;
  factory GraphReview.fromJson(Map<String, dynamic> json) => GraphReview(
    id: json['id'] as String? ?? '',
    claimId: json['claimId'] as String? ?? '',
    title: json['title'] as String? ?? '',
    summary: json['summary'] as String? ?? '',
    status: json['status'] as String? ?? 'UNKNOWN',
  );
}

class GraphRelation {
  const GraphRelation({required this.id, required this.from, required this.to, required this.type, required this.label});
  final String id;
  final String from;
  final String to;
  final String type;
  final String label;
  factory GraphRelation.fromJson(Map<String, dynamic> json) => GraphRelation(
    id: json['id'] as String? ?? '',
    from: json['from'] as String? ?? '',
    to: json['to'] as String? ?? '',
    type: json['type'] as String? ?? 'related',
    label: json['label'] as String? ?? '',
  );
}
