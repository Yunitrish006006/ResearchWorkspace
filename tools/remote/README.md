# ResearchWorkspace Remote Bridge

This is the ResearchWorkspace domain port of TotemWorkspace's Remote-SSH/tmux bridge controller.

The Bridge remains loopback-only on `127.0.0.1:18775`. Use SSH local forwarding rather than exposing
the port publicly.

## Common commands

```bash
bash tools/remote/bridge.sh doctor
bash tools/remote/bridge.sh start
bash tools/remote/bridge.sh status
bash tools/remote/bridge.sh logs
bash tools/remote/bridge.sh restart
```

If tmux is available it is preferred; otherwise the controller uses nohup. Flutter 3.47.0 is pinned and
can be bootstrapped in user space without sudo.

To enable real Codex task execution:

```bash
export RESEARCH_AGENT_ADAPTER=codex
export RESEARCH_CODEX_CWD="$HOME/workspace/ResearchWorkspace"
export RESEARCH_CODEX_SANDBOX=workspace-write
bash tools/remote/bridge.sh restart
```

Set `RESEARCH_CODEX_CWD` to either ResearchWorkspace or the canonical thesis checkout. The adapter rejects
CWDs outside those roots.

For Remote-SSH, forward the loopback port:

```sshconfig
LocalForward 127.0.0.1:18775 127.0.0.1:18775```

A normal stop/restart refuses to terminate the Bridge while Codex is busy. Emergency override:

```bash
RESEARCH_BRIDGE_FORCE=1 bash tools/remote/bridge.sh restart
```
