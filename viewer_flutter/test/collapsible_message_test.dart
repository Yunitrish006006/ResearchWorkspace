import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:research_workspace_viewer/widgets/collapsible_message.dart';

void main() {
  testWidgets('long message can expand', (tester) async {
    const text='A long research message that should wrap over several visual lines when the width is deliberately narrow. It keeps provenance and review notes readable without permanently occupying the graph.';
    await tester.pumpWidget(const MaterialApp(home:SizedBox(width:150,child:CollapsibleMessage(text:text,style:TextStyle(fontSize:14)))));
    expect(find.text('展開完整訊息'),findsOneWidget);
    await tester.tap(find.text('展開完整訊息'));
    await tester.pump();
    expect(find.text('收起訊息'),findsOneWidget);
  });
}
