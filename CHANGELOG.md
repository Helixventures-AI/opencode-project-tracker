# Changelog / تغییرات

All notable changes to **ai-project-tracker**. / تمام تغییرات مهم **ai-project-tracker**.

Format based on [Keep a Changelog](https://keepachangelog.com/). / قالب بر اساس Keep a Changelog.

## [1.4.4] — 2026-08-14

### Added / افزودهها
- **Bilingual documentation / مستندات دوزبانه**: full Persian README (`README.fa.md`) + language switcher in the English README.
- **Per-platform guides / راهنمای هر پلتفرم** in `docs/`: `OPENCODE.md`, `CLAUDE-CODE.md`, `MCP.md`, `CLI.md`, `WEB-PLATFORMS.md`.
- **Changelog** (`CHANGELOG.md`).

### Fixed / اصلاحشده
- npm package now ships the plugin as its root export, so `"plugin": ["ai-project-tracker"]` works in opencode; added `./core`, `./mcp`, `./cli`, `./plugin` subpaths; `opencode-plugin` keyword; docs included in the tarball.

---

## [1.4.3] — 2026-08-14

### Added / افزودهها
- npm package renamed **opencode-project-tracker → ai-project-tracker** (name was free on npm).

### Fixed / اصلاحشده
- `bin` path corrected for `normalize-package-bin`.
- Repository URL updated to the renamed repo.

---

## [1.4.2] — 2026-08-14

### Added / افزودهها
- **Notes with phase & weight / یادداشت با فاز و وزن**: `tracker_note` / `pt note` accepts `phase` + `weight` for retroactive scoring (score, event and phase stats). Invalid phase falls back to the active phase.

---

## [1.4.1] — 2026-08-14

### Added / افزودهها
- **Git history import / ایمپورت تاریخچهٔ گیت**: `pt import-git` / MCP `tracker_import_git` backfills all phases from past commits (idempotent, honest timestamps, verified successes).

---

## [1.4.0] — 2026-08-14

### Added / افزودهها
- **Multi-platform suite / بستهٔ چندپلتفرمی**: shared core engine (`core/tracker-core.mjs`) powering the opencode plugin, Claude Code hooks, MCP server, CLI and web-AI file protocol.
- **Universal MCP installer / نصاب سراسری MCP** (`mcp/install.mjs`) for Claude Code, Claude Desktop, Cursor, Windsurf, VS Code Copilot.
- **`/tracker` command for Claude Code** (`claude-commands/tracker.md`).
- **15 stat cards + modern dashboard / داشبورد ۱۵ کارتی**; bilingual EN/FA toggle.
- **Recommendations & Solutions / پیشنهادها و راهحلها** (auto insights + agent notes).
- **Warning reporting / گزارش هشدار** for skipped/invalid data.
- **Milestones on imported data, idle detection, corrupt-state protection**.

### Fixed / اصلاحشده
- Duplicate Persian stat label (`stat-fa`).