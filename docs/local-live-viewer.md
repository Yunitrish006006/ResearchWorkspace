# Local live viewer

Start directly:

```bash
node scripts/serve-local-viewer.mjs
```

or through the Remote-SSH controller:

```bash
bash tools/remote/bridge.sh start
```

The Bridge binds only `127.0.0.1:18775`.

When a local Flutter Web build exists, `/` serves the Flutter production UI and `/legacy/` serves
the JavaScript debug/rollback surface. Without a Flutter build the site fallback remains usable.

Live API includes repository status, graph data, artifact drift, Change Intelligence, verification,
activity, orchestration, prompt submission, Research Replay, Agent Adapter status, and private
conversation-sync routes.

GitHub Pages may connect back to the loopback API for live local overlays. Private conversation
transcript/draft routes remain restricted to loopback or the authenticated transport.
