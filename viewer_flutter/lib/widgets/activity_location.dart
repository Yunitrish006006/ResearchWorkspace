import 'package:flutter/material.dart';

import '../live/workspace_live.dart';

/// Transient research source locator derived only from one live activity event.
///
/// This intentionally does not maintain a second modified-files list. The
/// repository/path/semantic locator stays bounded to event metadata.
class ActivitySourceLocation {
  const ActivitySourceLocation({
    required this.repository,
    required this.file,
    this.topicId,
    this.claimId,
    this.sourceAreaId,
    this.symbol,
  });

  final String repository;
  final String file;
  final String? topicId;
  final String? claimId;
  final String? sourceAreaId;
  final String? symbol;

  static ActivitySourceLocation? fromEvent(ActivityEvent event) {
    final file = event.file?.trim();
    final supportsLocation =
        event.type == 'file_edit' || event.type == 'symbol_edit';
    if (!supportsLocation || file == null || file.isEmpty) return null;
    final repository = event.repository?.trim();
    return ActivitySourceLocation(
      repository: repository == null || repository.isEmpty
          ? 'Thesis workspace'
          : repository,
      file: file,
      topicId: _clean(event.topicId),
      claimId: _clean(event.claimId),
      sourceAreaId: _clean(event.sourceAreaId),
      symbol: _clean(event.symbol),
    );
  }

  String get pathLabel => repository + ' · ' + file;

  List<String> get semanticTargets => [
    if (claimId != null) 'Claim · ' + claimId!,
    if (topicId != null) 'Topic · ' + topicId!,
    if (sourceAreaId != null) 'Source Area · ' + sourceAreaId!,
    if (symbol != null) 'Symbol · ' + symbol!,
  ];

  String? get semanticTarget => claimId ?? sourceAreaId ?? topicId;

  bool matches(ActivitySourceLocation? other) =>
      other != null &&
      repository == other.repository &&
      file == other.file &&
      symbol == other.symbol;

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
    required this.keptOpen,
    required this.onKeepOpenChanged,
    this.onHoverChanged,
  });

  final ActivitySourceLocation location;
  final ValueChanged<Rect> onTap;
  final bool keptOpen;
  final VoidCallback onKeepOpenChanged;
  final ValueChanged<bool>? onHoverChanged;

  void _reportTap(BuildContext context) {
    final card = context.findRenderObject();
    final overlay = Overlay.of(context, rootOverlay: true).context.findRenderObject();
    if (card is! RenderBox || overlay is! RenderBox) return;
    final topLeft = card.localToGlobal(Offset.zero, ancestor: overlay);
    onTap(topLeft & card.size);
  }

  @override
  Widget build(BuildContext context) => Builder(
    builder: (cardContext) => MouseRegion(
      onEnter: (_) => onHoverChanged?.call(true),
      onExit: (_) => onHoverChanged?.call(false),
      child: Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF0C2030),
            border: Border.all(
              color: keptOpen ? const Color(0xFFFBBF24) : const Color(0xFF24536B),
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Expanded(
                child: Semantics(
                  button: true,
                  label: '查看研究變更位置：' + location.pathLabel,
                  child: Tooltip(
                    message: '查看這次研究變更的 repository、檔案與語意位置',
                    child: InkWell(
                      onTap: () => _reportTap(cardContext),
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
                                  const Text('查看研究變更位置', style: TextStyle(color: Color(0xFFBAE6FD), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: .25)),
                                  const SizedBox(height: 1),
                                  Text(location.pathLabel, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFE0F2FE), fontFamily: 'monospace', fontSize: 11, height: 1.25)),
                                  if (location.semanticTargets.isNotEmpty)
                                    Text(location.semanticTargets.first, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFF93C5FD), fontSize: 10)),
                                ],
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.open_in_new, size: 14, color: Color(0xFF7DD3FC)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 34, child: VerticalDivider(width: 1, color: Color(0xFF24536B))),
              Tooltip(
                message: keptOpen ? '取消固定研究定位' : '游標移開後仍固定研究定位',
                child: TextButton.icon(
                  onPressed: onKeepOpenChanged,
                  icon: Icon(keptOpen ? Icons.push_pin : Icons.push_pin_outlined, size: 15),
                  label: Text(keptOpen ? '已固定' : '固定'),
                  style: TextButton.styleFrom(
                    foregroundColor: keptOpen ? const Color(0xFFFDE68A) : const Color(0xFFBAE6FD),
                    padding: const EdgeInsets.symmetric(horizontal: 9),
                    textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
