# opencode-project-tracker

Real-time project progress tracker plugin for [opencode](https://opencode.ai).

Tracks every operation (edit, test, deploy, docs, commit, ...) during a coding session, maps it to one of **7 project phases**, computes per-phase and overall **percentages**, a **growth rate**, and renders a **modern HTML dashboard** with SVG charts — fully **local, no data leaves your machine**.

![dashboard](https://img.shields.io/badge/dashboard-dark%20theme-8b5cf6) ![platform](https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-22d3ee) ![license](https://img.shields.io/badge/license-MIT-green)

## Features

- 🧭 **7 standard phases** — Research & Planning, Architecture & Setup, Implementation, Testing & QA, Documentation, Deployment & DevOps, Review & Delivery (each with Persian + English descriptions)
- 🌐 **Bilingual dashboard** — one-click language toggle (فارسی / English) that switches every label, phase name and description; your choice is remembered
- 📊 **Live dashboard** — `report.html`: overall progress ring, per-phase progress bars with percentages, score-over-time growth chart **with a dashed projection line**, recent-activity feed, milestone badges (25/50/75/100%), stat cards (tool calls, tests, deploys, commits, sessions...)
- ⚡ **Growth rate & ETA** — points per hour plus a **predicted time-to-completion** estimate
- 🏆 **Milestones** — auto-recorded progress thresholds with badge chips
- 🗂️ **Multi-project comparison** — a global registry (`~/.config/opencode/project-tracker/projects.json`) tracks all projects you work on; the dashboard shows how they compare
- 📄 **Markdown report** — `report.md` generated alongside the HTML dashboard (ready for docs/commits)
- ⚙️ **Configurable** — `config.json` to customize phase goals, tool weights and phase names (per-project or global)
- 🗃️ **Persistence** — state survives restarts, accumulates across sessions in `<project>/.opencode/project-tracker/`
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
- ETA = remaining points / growth rate (appears once enough history exists).
- Output files:

```
<project>/.opencode/project-tracker/
├── state.json    # machine-readable progress state
├── report.html   # self-contained visual dashboard (no internet needed)
├── report.md     # markdown summary
└── config.json   # optional: your customization (see below)
```

Global registry (all projects you track): `~/.config/opencode/project-tracker/projects.json`

## Configuration

Create `config.json` in `.opencode/project-tracker/` (per-project) or `~/.config/opencode/project-tracker/config.json` (global — project config overrides global):

```json
{
  "goals": { "coding": 80, "testing": 40 },
  "weights": { "edit": 2, "bash": 1 },
  "names": {
    "coding": { "en": "Coding", "fa": "کدنویسی" }
  }
}
```

- `goals` — target score per phase (keys: `research`, `setup`, `coding`, `testing`, `docs`, `deploy`, `delivery`)
- `weights` — override the weight of a specific tool (e.g. `edit`, `bash`, `read`, `write`, `task`)
- `names` — rename a phase in the dashboard (EN/FA)

### Custom phase lists (any number of phases)

If your project has a different workflow, replace the 7 default phases entirely with your own — more or fewer, any count:

```json
{
  "phases": [
    { "key": "planning", "en": "Planning", "fa": "برنامه‌ریزی", "desc_en": "Scope", "desc_fa": "دامنه", "goal": 20 },
    { "key": "build",    "en": "Build",    "fa": "ساخت",       "desc_en": "Code", "desc_fa": "کد",   "goal": 50 },
    { "key": "qa",       "en": "QA",       "fa": "کنترل کیفیت","desc_en": "Tests","desc_fa": "تست‌ها","goal": 20 },
    { "key": "release",  "en": "Release",  "fa": "انتشار",     "desc_en": "Ship", "desc_fa": "تحویل", "goal": 10 }
  ],
  "remap": { "coding": "build", "testing": "qa", "deploy": "release", "delivery": "release" },
  "default_phase": "planning"
}
```

- `phases` — your own list (fields `key`, `en`, `fa`, `desc_en`, `desc_fa`, `goal`, `color`; `key` is required, the rest fall back to defaults, colors auto-assigned from a palette)
- `remap` — map the built-in classification keys (`research`, `setup`, `coding`, `testing`, `docs`, `deploy`, `delivery`) to your phase keys
- `default_phase` — where unmatched operations go (default: first phase)

## Progress notes (bugs, errors, successes)

Every operation gets an automatic **status** — ✅ success / ❌ error / ⚠️ warning — with a short description of what actually happened (test output, file touched, error text). Totals are shown on the dashboard and in `report.md`.

You can also record explicit notes — e.g. a bug found, an error fixed, a successful deploy — by asking the assistant to call the built-in `tracker_note` tool:

```
Use tracker_note with text: "fixed auth bug — token expiry" and type: "success"
```

Types: `success`, `error`, `warning`, `info`. Notes appear instantly in the activity log and count toward the error/success totals.

## Recommendations & Solutions

The dashboard has a **💡 Recommendations & Solutions** section that combines:

1. **Automatic insights** — derived from the recorded data:
   - ❌ errors grouped per phase, each with a targeted fix (failed tests → run with `--nocapture`; `not found` → check path/imports; denied → check permissions; `panic/unwrap` → null handling; ports, timeouts, etc.)
   - ⚠️ high error-rate warning (≥ 20%)
   - 🧪 missing tests, 💾 edits without commits, 📚 no documentation, 🚀 phases not started yet, ✅ healthy pace, 🎉 project complete

2. **Agent suggestions & solutions** — record your own recommendations, they appear on top with 💡/🔧:

```
Use tracker_note with text: "prefer lockfile for reproducible builds" and type: "suggestion"
Use tracker_note with text: "split the big query into two to fix the timeout" and type: "solution"
```

Types: `suggestion`, `solution`, `recommendation` (also visible as a stat card). The same list is included in `report.md`.

## Automatic import of existing progress

Starting a tracker on an **existing project**? No more empty dashboard. The plugin automatically scans the project for progress files and imports completed steps into the phase scores:

- root level: `USL_PROGRESS.md`, `PROGRESS.md`, `progress*.json`, `ROADMAP.md`, `roadmap*.json`
- subfolders: `reports/`, `docs/`, `planning/`, `plans/`, `progress/` (2 levels deep)

**Supported formats (auto-detected, no configuration needed):**

1. JSON array of steps:
```json
[
  { "id": "s1", "name": "schema migration 011", "phase": "testing", "status": "committed", "score": 2 },
  { "id": "s2", "name": "GDPR erasure endpoint", "phase": "coding", "status": "done" },
  { "id": "s3", "name": "audit retention docs", "phase": "docs", "status": "todo" }
]
```
Statuses `done`/`complete`/`committed`/`ok`/`شده` score points; `todo` items register the phase without points. Phase field auto-detected (`phase`/`fase`/`stage`/`category`/`area`/`key`), score field auto-detected (`score`/`points`/`weight`/`value`, default 1).

2. JSON map: `{ "phases": { "coding": 80, "testing": 30 } }` or plain `{ "coding": 80 }`.

3. Markdown checklist with `## Phase` headings (or `(phase: key)` inline):
```md
## Testing
- [x] run integration suite
- [ ] add coverage for privacy module
- [x] smoke flow (phase: deploy)
```

**Behavior:** imports are idempotent — restarting opencode never double-counts (tracked by file mtime + item ids); when a progress file changes, new steps are imported automatically. The header shows `📥 واردشده: N گام از <files>`, a stat card counts imported steps, and the chart starts from the imported total. Disable with `"auto_seed": false` in `config.json`.

## Customization

Edit `PHASE_DEFAULTS` in `project-tracker.ts` to change phase names, goals or colors.

## Development

```sh
# syntax check
npx esbuild project-tracker.ts --bundle --platform=node --format=esm --external:@opencode-ai/plugin --outfile=/tmp/check.mjs
```

## License

MIT
