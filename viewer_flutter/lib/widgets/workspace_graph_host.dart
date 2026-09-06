import 'package:flutter/material.dart';
import '../model/graph_data.dart';
import 'graph_view.dart';

/// Production host boundary retained from the TotemWorkspace viewer architecture.
///
/// GraphView owns camera and live interaction state; the host owns the initial
/// graph contract and is the stable application entry point. This keeps the
/// production root free to add app-level routing/panels without coupling main.dart
/// to the renderer.
class WorkspaceGraphHost extends StatefulWidget {
  const WorkspaceGraphHost({super.key, required this.initialData});
  final GraphData initialData;

  @override
  State<WorkspaceGraphHost> createState() => _WorkspaceGraphHostState();
}

class _WorkspaceGraphHostState extends State<WorkspaceGraphHost> {
  late GraphData _data;

  @override
  void initState() {
    super.initState();
    _data = widget.initialData;
  }

  @override
  void didUpdateWidget(covariant WorkspaceGraphHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.initialData, widget.initialData)) {
      _data = widget.initialData;
    }
  }

  @override
  Widget build(BuildContext context) => GraphView(data: _data);
}
