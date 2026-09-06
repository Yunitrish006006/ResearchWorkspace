import 'package:flutter_test/flutter_test.dart';
import 'package:research_workspace_viewer/live/workspace_live.dart';
import 'package:research_workspace_viewer/widgets/activity_location.dart';

void main() {
  test('file_edit activity exposes bounded research source location', () {
    const event=ActivityEvent(
      sequence:1,
      type:'file_edit',
      summary:'updated',
      repository:'Three-Factor-Digital-Twin',
      file:'docs/thesis/thesis_draft_zh.md',
      topicId:'governance',
      claimId:'claim-sync',
    );
    final location=ActivitySourceLocation.fromEvent(event);
    expect(location,isNotNull);
    expect(location!.pathLabel,contains('docs/thesis/thesis_draft_zh.md'));
    expect(location.semanticTarget,'claim-sync');
  });

  test('non-file activity has no source location', () {
    const event=ActivityEvent(sequence:1,type:'task_started',summary:'started');
    expect(ActivitySourceLocation.fromEvent(event),isNull);
  });
}
