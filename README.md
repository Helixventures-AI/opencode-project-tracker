# opencode-project-tracker

Real-time project progress tracker plugin for [opencode](https://opencode.ai).

Tracks every operation (edit, test, deploy, docs, commit, ...) during a coding session, maps it to one of **7 project phases**, computes per-phase and overall **percentages**, a **growth rate**, and renders a **modern HTML dashboard** with SVG charts — fully **local, no data leaves your machine**.

![dashboard](https://img.shields.io/badge/dashboard-dark%20theme-8b5cf6) ![platform](https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-22d3ee) ![license](https://img.shields.io/badge/license-MIT-green)

## Features

- 🧭 **7 standard phases** — Research & Planning, Architecture & Setup, Implementation, Testing & QA, Documentation, Deployment & DevOps, Review & Delivery (each with Persian + English descriptions)
- 📊 **Live dashboard** — `report.html`: overall progress ring, per-phase progress bars with percentages, score-over-time growth chart, stat cards (tool calls, tests, deploys, commits, sessions...)
- ⚡ **Growth rate** — points gained per hour
- 🗂️ **Persistence** — state survives restarts, accumulates across sessions in `<project>/.opencode/project-tracker/`
- 🔒 **100% local** — no network, no telemetry, no external CDNs (inline CSS/SVG)
- 🌍 **Cross-platform** — Windows / macOS / Linux

## Install

### Option A — local (any single machine)

Put the plugin file in the plugin directory and restart opencode:

- Project-level: `.opencode/plugins/project-tracker.ts`
- Global (all projects): `~/.config/opencode/plugins/project-tracker.ts`

Optionally add the `/tracker` command (shows a text summary in chat + opens the dashboard):

- `.opencode/command/tracker.md` or `~/.config/opencode/command/tracker.md`

### Option B — npm (opencode.json)

```json
{
  "plugin": ["opencode-project-tracker"]
}
```

> Published package must exist on npm for this to work.

## Usage

While working with opencode, the plugin records every tool operation in real time. To view progress:

1. Type `/tracker` (or `/t`) in the opencode prompt — a bilingual (EN/FA) numeric summary appears in chat and the dashboard opens in your browser.
2. Or press `ctrl+p` and pick **tracker** from the command list.
3. The dashboard auto-updates after every operation (throttled ~4s).

## How it works

- Each tool call is classified into a phase with a weight (tests/deploys weigh more than reads).
- Phase progress = `score / goal` (goals are pre-defined per phase).
- Overall progress = total score / total goals, capped at 100%.
- Growth rate = score delta over the last 60 minutes, per hour.
- Output files:

```
<project>/.opencode/project-tracker/
├── state.json    # machine-readable progress state
└── report.html   # self-contained visual dashboard (no internet needed)
```

## Customization

Edit `PHASES` in `project-tracker.ts` to change phase names, goals or colors.

## Development

```sh
# syntax check
npx esbuild project-tracker.ts --bundle --platform=node --format=esm --external:@opencode-ai/plugin --outfile=/tmp/check.mjs
```

## License

MIT
