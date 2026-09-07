import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:research_workspace_viewer/live/workspace_live.dart';
import 'package:research_workspace_viewer/widgets/activity_location.dart';

void main() {
  test('file and symbol edits expose bounded research source locations', () {
    const fileEvent = ActivityEvent(
      sequence: 1,
      type: 'file_edit',
      summary: 'updated',
      repository: 'Three-Factor-Digital-Twin',
      file: 'docs/thesis/thesis_draft_zh.md',
      topicId: 'governance',
      claimId: 'claim-sync',
      sourceAreaId: 'source-area:thesis-draft',
    );
    final fileLocation = ActivitySourceLocation.fromEvent(fileEvent);
    expect(fileLocation, isNotNull);
    expect(fileLocation!.pathLabel, contains('docs/thesis/thesis_draft_zh.md'));
    expect(fileLocation.semanticTarget, 'claim-sync');
    expect(fileLocation.semanticTargets, contains('Claim · claim-sync'));

    const symbolEvent = ActivityEvent(
      sequence: 2,
      type: 'symbol_edit',
      summary: 'estimator changed',
      repository: 'Three-Factor-Digital-Twin',
      file: 'digital_twin/estimation/hybrid.py',
      topicId: 'method',
      symbol: 'HybridResidualEstimator.fit',
    );
    final symbolLocation = ActivitySourceLocation.fromEvent(symbolEvent);
    expect(symbolLocation, isNotNull);
    expect(symbolLocation!.semanticTargets, contains('Symbol · HybridResidualEstimator.fit'));
  });

  test('non-edit activity has no source location', () {
    const event = ActivityEvent(sequence: 3, type: 'task_started', summary: 'started', file: 'README.md');
    expect(ActivitySourceLocation.fromEvent(event), isNull);
  });

  testWidgets('research source location card reports anchor, hover and pin intent', (tester) async {
    Rect? anchor;
    var pinRequested = false;
    final hoverStates = <bool>[];
    const location = ActivitySourceLocation(
      repository: 'Three-Factor-Digital-Twin',
      file: 'docs/thesis/thesis_draft_zh.md',
      claimId: 'claim-sync',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: 360,
              child: ActivitySourceLocationCard(
                location: location,
                keptOpen: false,
                onTap: (value) => anchor = value,
                onKeepOpenChanged: () => pinRequested = true,
                onHoverChanged: hoverStates.add,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('查看研究變更位置'));
    expect(anchor, isNotNull);
    expect(anchor!.size, isNot(Size.zero));

    await tester.tap(find.text('固定'));
    expect(pinRequested, isTrue);

    final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
    await mouse.addPointer(location: const Offset(1, 1));
    await mouse.moveTo(tester.getCenter(find.text('查看研究變更位置')));
    await tester.pump();
    expect(hoverStates, contains(true));

    await mouse.moveTo(const Offset(799, 599));
    await tester.pump();
    expect(hoverStates.last, isFalse);
  });

  test('locations match by repository, path and optional symbol', () {
    const a = ActivitySourceLocation(repository: 'repo', file: 'a.dart', symbol: 'A.run');
    const b = ActivitySourceLocation(repository: 'repo', file: 'a.dart', symbol: 'A.run', claimId: 'claim-x');
    const c = ActivitySourceLocation(repository: 'repo', file: 'a.dart', symbol: 'A.stop');
    expect(a.matches(b), isTrue);
    expect(a.matches(c), isFalse);
  });
}
