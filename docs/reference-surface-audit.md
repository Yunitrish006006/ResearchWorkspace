# TotemWorkspace reference-surface audit

ResearchWorkspace treats `Yunitrish006006/TotemWorkspace` as the behavioral reference implementation, not merely a UI example.

`data/reference-surface-map.json` now records two layers of parity:

1. **Repository-family coverage** — every tracked TotemWorkspace file must belong to a classified subsystem family (`port`, `replace`, or an explicitly justified domain exclusion).
2. **Required behavioral counterparts** — core intelligence, MCP, Bridge, replay, verification, agent adapter, Flutter viewer, legacy viewer, remote tooling, and CodexDiscord files have explicit ResearchWorkspace counterparts.

The scheduled `Check Totem Reference Drift` workflow clones the audited Totem commit and verifies the full tracked-file surface. It fails when the upstream HEAD changes, the tracked-file count changes, a new file falls outside the classified families, a required Totem path disappears, or a required ResearchWorkspace counterpart is missing.

This is deliberately stricter than the capability ledger alone: a capability cannot be considered parity-complete merely because one evidence file exists.
