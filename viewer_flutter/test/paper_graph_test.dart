import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:research_workspace_viewer/widgets/graph_view.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:research_workspace_viewer/model/graph_data.dart';
import 'package:research_workspace_viewer/model/graph_scene.dart';

void main() {
  final data = GraphData.fromJson({
    'paperGraph': {
      'nodes': [
        {'id':'main','kind':'paper','label':'Main'},
        {'id':'other','kind':'paper','label':'Other'},
        {'id':'section','kind':'point','label':'Section','parentId':'main'},
        {'id':'result','kind':'result','label':'Result','parentId':'section'},
        {'id':'source','kind':'point','label':'Original point','parentId':'other'},
      ],
      'relations': [
        {'id':'citation','from':'section','to':'source','type':'cites','label':'Precise citation'},
        {'id':'compare','from':'result','to':'source','type':'compares','label':'Worse MAE','outcome':'WORSE'},
      ],
    },
  });
  testWidgets('paper details and view switch render without layout errors', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:GraphView(data:data,focusNodeId:'main'))));
    await tester.pump(const Duration(milliseconds:100));
    expect(find.text('對應關係與雙方定位'), findsOneWidget);
    expect(find.text('Precise citation'), findsOneWidget);
    await tester.tap(find.text('研究治理視圖'));
    await tester.pump(const Duration(milliseconds:100));
    expect(find.text('論文視圖'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    await tester.binding.setSurfaceSize(null);
  });
  test('generated graph supports fully expanded and collapsed scenes', () {
    final generated=GraphData.fromJson(jsonDecode(File('assets/graph-data.json').readAsStringSync()) as Map<String,dynamic>);
    final initial=buildGraphScene(generated);
    expect(initial.nodes.every((n)=>n.kind=='paper'),isTrue);
    final all=buildGraphScene(generated,expanded:generated.paperNodes.map((n)=>n.id).toSet());
    expect(all.nodes.length,generated.paperNodes.length);
    expect(all.nodes.every((n)=>n.position.x.isFinite&&n.position.y.isFinite&&n.position.z.isFinite),isTrue);
    expect(all.edges.any((e)=>e.outcome=='WORSE'),isTrue);
  });
  test('first layer consists of papers and collapsed relations retain direction', () {
    final scene=buildGraphScene(data);
    expect(scene.nodes.map((n)=>n.id), ['main','other']);
    expect(scene.nodes.every((n)=>n.kind=='paper'),isTrue);
    expect(scene.edges.every((e)=>e.from=='main'&&e.to=='other'),isTrue);
    expect(scene.edges.firstWhere((e)=>e.type=='compares').outcome,'WORSE');
  });
  test('expansion reveals endpoints progressively and filters preserve hierarchy', () {
    final mid=buildGraphScene(data,expanded:{'main'});
    expect(mid.nodes.map((n)=>n.id),contains('section'));
    expect(mid.nodes.map((n)=>n.id),isNot(contains('result')));
    final deep=buildGraphScene(data,expanded:{'main','section','other'},enabledFilters:{'compares'});
    expect(deep.edges.single.from,'result');
    expect(deep.edges.single.to,'source');
    expect(buildGraphScene(data,expanded:{'section'}).nodes.map((n)=>n.id),isNot(contains('result')));
  });
}
