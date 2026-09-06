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
      relations: [],
    );
    expect(buildGraphScene(data).nodes.map((x) => x.id), containsAll(['thesis', 't']));
    expect(buildGraphScene(data, expanded: {'t'}).nodes.map((x) => x.id), contains('c'));
    expect(buildGraphScene(data, expanded: {'t', 'c'}).nodes.map((x) => x.id), contains('s'));
  });
}
