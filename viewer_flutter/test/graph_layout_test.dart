import 'package:flutter_test/flutter_test.dart';
import 'package:research_workspace_viewer/model/graph_data.dart';
import 'package:research_workspace_viewer/model/graph_scene.dart';

void main() {
  test('semantic LOD expands topic then claim', () {
    const data = GraphData(
      snapshotDate: 'test',
      root: GraphRoot(id: 'thesis', name: 'Thesis', summary: ''),
      topics: [GraphTopic(id: 't', name: 'Topic', summary: '', rankHint: 1)],
      claims: [GraphClaim(id: 'c', ownerId: 't', title: 'Claim', summary: '', status: 'SUPPORTED')],
      studies: [GraphStudy(id: 's', claimId: 'c', title: 'Study', kind: 'METHOD', summary: '')],
      evidence: [],
      reviews: [],
      sourceAreas: [GraphSourceArea(id: 'a', claimId: 'c', family: 'openspec', title: 'Sources', summary: '', artifactIds: ['f'])],
      artifacts: [GraphArtifact(id: 'f', sourceId: 'source:x', claimId: 'c', areaId: 'a', title: 'spec.md', path: 'spec.md', family: 'openspec', summary: '', sha256: 'abc', chunkCount: 1, mappingConfidence: 1, mappingReason: 'registered')],
      relations: [],
    );
    expect(buildGraphScene(data).nodes.map((x) => x.id), containsAll(['thesis', 't']));
    expect(buildGraphScene(data, expanded: {'t'}).nodes.map((x) => x.id), contains('c'));
    final l3 = buildGraphScene(data, expanded: {'t', 'c'});
    expect(l3.nodes.map((x) => x.id), containsAll(['s', 'a']));
    expect(buildGraphScene(data, expanded: {'t', 'c', 'a'}).nodes.map((x) => x.id), contains('f'));
  });

  test('edge filters remove disabled research relationship families while keeping hierarchy', () {
    const data = GraphData(
      snapshotDate: 'test',
      root: GraphRoot(id: 'thesis', name: 'Thesis', summary: ''),
      topics: [GraphTopic(id: 't', name: 'Topic', summary: '', rankHint: 1)],
      claims: [GraphClaim(id: 'c', ownerId: 't', title: 'Claim', summary: '', status: 'SUPPORTED')],
      studies: [GraphStudy(id: 's', claimId: 'c', title: 'Method', kind: 'METHOD', summary: '')],
      evidence: [GraphEvidence(id: 'e', claimId: 'c', title: 'Evidence', summary: '', path: 'e.md', evidenceClass: 'controlled')],
      reviews: [GraphReview(id: 'r', claimId: 'c', title: 'Review', summary: '', status: 'PASS')],
      sourceAreas: [],
      artifacts: [],
      relations: [],
    );
    final filtered = buildGraphScene(
      data,
      expanded: {'t', 'c'},
      enabledFilters: {'validated-by'},
    );
    expect(filtered.edges.any((edge) => edge.type == 'supports'), isFalse);
    expect(filtered.edges.any((edge) => edge.type == 'uses-method'), isFalse);
    expect(filtered.edges.any((edge) => edge.type == 'validated-by'), isTrue);
    expect(filtered.edges.any((edge) => edge.type == 'contains'), isTrue);
  });

  test('cross-topic claim relations bias semantic placement toward the related topic', () {
    const data = GraphData(
      snapshotDate: 'test',
      root: GraphRoot(id: 'thesis', name: 'Thesis', summary: ''),
      topics: [
        GraphTopic(id: 't1', name: 'Topic 1', summary: '', rankHint: 1),
        GraphTopic(id: 't2', name: 'Topic 2', summary: '', rankHint: 2),
      ],
      claims: [
        GraphClaim(id: 'c1', ownerId: 't1', title: 'Claim 1', summary: '', status: 'SUPPORTED'),
        GraphClaim(id: 'c2', ownerId: 't2', title: 'Claim 2', summary: '', status: 'SUPPORTED'),
      ],
      studies: [],
      evidence: [],
      reviews: [],
      sourceAreas: [],
      artifacts: [],
      relations: [
        GraphRelation(id: 'rel', from: 'c1', to: 'c2', type: 'limits', label: 'boundary'),
      ],
    );
    final scene = buildGraphScene(data, expanded: {'t1'});
    final owner = scene.byId['t1']!.position;
    final claim = scene.byId['c1']!.position;
    final target = scene.byId['t2']!.position;
    expect((claim - owner).dot(target - owner), greaterThan(0));
  });
}
