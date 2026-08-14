# 🌐 Project Tracker on Web AI platforms (Replit, Lovable, Bolt, v0, Cursor Web, ...)

Web AI environments cannot install plugins. Instead they use the **file protocol**: the AI agent maintains a progress file, and you generate the dashboard locally with one command. The tracker engine already reads both formats natively (auto-seed).

## Workflow (3 steps)

1. **Paste instructions** — copy `AGENT_INSTRUCTIONS.md` into your web AI agent's instructions (or mention "keep USL_PROGRESS.md / progress.json updated per the protocol").
2. **Work** — the agent appends done/todo steps after every task.
3. **Generate the dashboard** — on your machine, in the project folder:

```sh
# one-time: make the CLI available (from this repo)
node cli/pt.mjs report      # re-import progress files → report.html + report.md
node cli/pt.mjs open        # open the dashboard in the browser
node cli/pt.mjs status      # text summary in the terminal
```

Or simply run `node cli/pt.mjs init` once, and afterwards `report` refreshes everything (idempotent — no double counting; changed files re-import automatically).

## Supported progress files (auto-detected anywhere in the project)

- Root: `USL_PROGRESS.md`, `PROGRESS.md`, `ROADMAP.md`, `progress*.json`, `roadmap*.json`
- Subfolders: `reports/`, `docs/`, `planning/`, `plans/`, `progress/` (2 levels)

Formats: JSON array of steps, JSON map (`{"coding": 80}`), or Markdown checklists with `## Phase` headings — all described in `AGENT_INSTRUCTIONS.md`.

## What you get

- `report.html` — the full bilingual (FA/EN) dashboard: progress ring, per-phase bars, growth chart with projection, milestones, recommendations, warnings
- `report.md` — markdown summary (ready for docs/commits)
- `state.json` — machine-readable state

## Example

```sh
cd ~/my-replit-project        # the folder the web agent works on
node /path/to/repo/cli/pt.mjs init
# ... agent works, updates progress.json ...
node /path/to/repo/cli/pt.mjs report
node /path/to/repo/cli/pt.mjs open
```