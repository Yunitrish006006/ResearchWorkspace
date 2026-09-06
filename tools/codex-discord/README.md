# ResearchWorkspace CodexDiscord

ResearchWorkspace CodexDiscord is the research-domain port of TotemWorkspace's allow-listed Discord/Codex surface.

It can run normal allow-listed Codex workspaces or use the ResearchWorkspace Local Bridge as a single shared
Codex queue. ResearchWorkspace and Three-Factor-Digital-Twin remain separate source-of-truth repositories.

## Setup

```bash
cd tools/codex-discord
cp .env.example .env
npm ci
npm test
node --env-file=.env src/index.mjs
```

Recommended allowlist:

```dotenv
CODEX_WORKSPACES_JSON={"research":"/home/user/workspace/ResearchWorkspace","thesis":"/home/user/workspace/Three-Factor-Digital-Twin"}
CODEX_WORKSPACE_ROOT=/home/user/workspace
```

Optional shared Bridge queue:

```dotenv
RESEARCH_WORKSPACE_SYNC_URL=http://127.0.0.1:18775/
RESEARCH_WORKSPACE_SYNC_TOKEN=replace-with-the-same-long-random-secret
RESEARCH_WORKSPACE_SYNC_CHANNEL_ID=your-allowed-channel-id
RESEARCH_WORKSPACE_SYNC_WORKSPACE=workspace
```

The sync token must match `RESEARCH_CONVERSATION_SYNC_TOKEN` used by
`scripts/serve-local-viewer.mjs`.

Security contracts are retained from TotemWorkspace: explicit user/channel/workspace allowlists, loopback-only
workspace sync, no arbitrary host path supplied by Discord, no dangerous sandbox bypass flags, and task-scoped
approval state.
