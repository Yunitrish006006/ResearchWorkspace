import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:research_workspace_viewer/widgets/floating_panel.dart';

void main() {
  testWidgets('floating panel stays visible and can collapse', (tester) async {
    var collapsed=false;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: StatefulBuilder(builder:(context,setState)=>FloatingPanel(
      title:'Details',
      icon:Icons.info_outline,
      dock:FloatingPanelDock.topRight,
      collapsed:collapsed,
      onCollapsedChanged:(value)=>setState(()=>collapsed=value),
      onDockChanged:(_){},
      child:const SizedBox(height:80,child:Text('body')),
    )))));
    expect(find.text('body'),findsOneWidget);
    await tester.tap(find.byTooltip('收合面板'));
    await tester.pump();
    expect(find.text('body'),findsNothing);
  });
}
