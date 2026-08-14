# opencode — install & usage

## 1. Install the plugin

### Option 1 — npm package (recommended)

Add to your `opencode.json` (project root or `~/.config/opencode/opencode.json` for global):

```json
{
  "plugin": ["ai-project-tracker"]
}
```

Restart opencode. The plugin loads from npm automatically.

### Option 2 — local plugin file

Copy `project-tracker.ts` into a plugin directory and restart opencode:

- Project-level: `.opencode/plugins/project-tracker.ts`
- Global (all projects): `~/.config/opencode/plugins/project-tracker.ts`

### Option 3 — from source

```sh
git clone https://github.com/Helixventures-AI/ai-project-tracker
cp ai-project-tracker/project-tracker.ts ~/.config/opencode/plugins/
```

## 2. Optional: `/tracker` command

Shows a bilingual (EN/FA) text summary in chat and opens the dashboard:

- `.opencode/command/tracker.md` (project) or `~/.config/opencode/command/tracker.md` (global)
- Copy from: `claude-commands/tracker.md` (same content works)

Or use the built-in `tracker` command / `ctrl+p` → **tracker** from the command list.

## 3. Usage

- The plugin records every tool call, chat message and session automatically — no manual steps.
- Type `/tracker` (or `/t`) in the prompt, or `ctrl+p` → **tracker**.
- The dashboard (`report.html`) auto-updates ~4s after each operation and opens in your browser.
- `/tracker <project-name>` shows any other tracked project.

## 4. Tracking other projects

- Every project where you open opencode with the plugin active is tracked automatically (id, name and path are stored in the global registry `~/.config/opencode/project-tracker/projects.json`).
- `tracker_open <project>` / `tracker_summary <project>` accept a name or path fragment.

## 5. Notes & git import

- Record results: `tracker_note` tool with `text` and `type` (`success`, `error`, `warning`, `info`, `suggestion`, `solution`, `recommendation`).
- Backfill past work from git history: `tracker_import_git` tool (args: `project`, `since`), or in a terminal: `pt import-git`.
- Uninstall: remove the `plugin` entry from `opencode.json` / delete the plugin file, then delete `.opencode/project-tracker/` if you want the data gone too.
