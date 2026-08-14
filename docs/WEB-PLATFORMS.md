# Web AI platforms (Replit, Lovable, Bolt, v0, ...)

Web AI builders can't install plugins or hooks — so the tracker defines a **file protocol**: the web agent maintains a progress file inside your project, and you regenerate the dashboard locally. No internet call, no API keys.

## How it works

```
web agent (in the cloud)                your machine
─────────────────────────              ─────────────────
writes/updates:
  USL_PROGRESS.md          ──────────▶  node cli/pt.mjs report
  progress.json            ──────────▶  node cli/pt.mjs open
```

The tracker **auto-seeds** from those files (also `PROGRESS.md`, `ROADMAP.md`, `progress*.json`, and files in `reports/`, `docs/`, `planning/`, `plans/`, `progress/`), so steps written by the web agent appear as phase progress — idempotently, without double counting.

## Setup

1. **Paste the agent instructions** into your web agent (e.g. Replit's "Instructions", Lovable's project brief, etc.). The instructions live in [`web/AGENT_INSTRUCTIONS.md`](../web/AGENT_INSTRUCTIONS.md) — copy its content, or reference it directly if the platform supports files.
2. The agent will now maintain `USL_PROGRESS.md` (and/or `progress.json`) as it works — marking tasks done, tests passing, deployments, etc.
3. On your machine (any terminal, no npm needed):

```sh
node cli/pt.mjs report     # pick up the agent's file and regenerate report.html
node cli/pt.mjs open       # view the dashboard
```

## Supported formats (auto-detected)

1. **JSON array of steps**

```json
[
  { "id": "s1", "name": "schema migration 011", "phase": "testing", "status": "committed", "score": 2 },
  { "id": "s2", "name": "GDPR erasure endpoint", "phase": "coding", "status": "done" }
]
```

2. **JSON map** — `{ "phases": { "coding": 80 } }` or plain `{ "coding": 80 }`

3. **Markdown checklist with `## Phase` headings** (or `(phase: key)` inline)

```md
## Testing
- [x] run integration suite
- [ ] add coverage for privacy module
- [x] smoke flow (phase: deploy)
```

Statuses `done/complete/committed/ok/شده` score points; `todo` items register the phase without points.

## Also works with the CLI

You can drive the tracker from any terminal on the project machine:

```sh
pt init            # first time
pt note success "web agent finished checkout flow" --phase coding --weight 2
pt status          # or: pt report && pt open
```

## Where the files live

```
<project>/.opencode/project-tracker/
├── state.json     # machine-readable state (written by both web-agent seeding and CLI)
├── report.html    # dashboard — open in any browser, fully offline
├── report.md      # markdown summary
└── config.json    # optional customization
```

See [`web/README.md`](../web/README.md) and [`web/AGENT_INSTRUCTIONS.md`](../web/AGENT_INSTRUCTIONS.md) for details.