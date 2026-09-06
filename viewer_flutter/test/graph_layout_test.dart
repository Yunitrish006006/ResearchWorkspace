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
}
