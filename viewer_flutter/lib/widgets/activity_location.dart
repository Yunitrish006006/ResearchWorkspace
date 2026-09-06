import 'package:flutter/material.dart';
import '../live/workspace_live.dart';

class ActivitySourceLocation {
  const ActivitySourceLocation({
    required this.repository,
    required this.file,
    this.topicId,
    this.claimId,
  });

  final String repository;
  final String file;
  final String? topicId;
  final String? claimId;

  static ActivitySourceLocation? fromEvent(ActivityEvent event) {
    final file = event.file?.trim();
    if (event.type != 'file_edit' || file == null || file.isEmpty) return null;
    final repository = event.repository?.trim();
    return ActivitySourceLocation(
      repository: repository == null || repository.isEmpty ? 'Thesis workspace' : repository,
      file: file,
      topicId: _clean(event.topicId),
      claimId: _clean(event.claimId),
    );
  }

  String get pathLabel => repository + ' · ' + file;
  String? get semanticTarget => claimId ?? topicId;

  static String? _clean(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}

class ActivitySourceLocationCard extends StatelessWidget {
  const ActivitySourceLocationCard({
    super.key,
    required this.location,
    required this.onTap,
  });

  final ActivitySourceLocation location;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: Ink(
      decoration: BoxDecoration(
        color: const Color(0xFF0C2030),
        border: Border.all(color: const Color(0xFF24536B)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
          child: Row(
            children: [
              const Icon(Icons.edit_note_outlined, size: 16, color: Color(0xFF67E8F9)),
              const SizedBox(width: 7),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('查看研究變更位置', style: TextStyle(color: Color(0xFFBAE6FD), fontSize: 10, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 1),
                    Text(location.pathLabel, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFE0F2FE), fontFamily: 'monospace', fontSize: 11, height: 1.25)),
                    if (location.semanticTarget != null)
                      Text('Graph · ' + location.semanticTarget!, style: const TextStyle(color: Color(0xFF93C5FD), fontSize: 10)),
                  ],
                ),
              ),
              const Icon(Icons.open_in_new, size: 14, color: Color(0xFF7DD3FC)),
            ],
          ),
        ),
      ),
    ),
  );
}
