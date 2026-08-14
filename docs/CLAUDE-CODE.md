# Claude Code — hooks, MCP and /tracker

Claude Code gets **full automatic tracking** via hooks: every tool call, user prompt, session start and stop is recorded into the same state files as the opencode plugin — one project, one dashboard, whichever tool you use.

## 1. Install hooks (automatic tracking)

```sh
node hooks/claude-code/install.mjs            # global: ~/.claude/settings.json (all projects)
node hooks/claude-code/install.mjs --project # this project only: .claude/settings.json
node hooks/claude-code/install.mjs --remove   # uninstall
```

Restart Claude Code. The installer is idempotent, preserves your existing `settings.json` and writes a `settings.backup.json` first.

### What the hooks do

| Event | Effect |
|---|---|
| `SessionStart` | registers the project |
| `UserPromptSubmit` | counts user messages |
| `PostToolUse` | classifies each tool call (Bash/Write/Edit/Read/...) into a phase, counts stats, detects verified results (`npm test` passed, git commit, deploy, ...) |
| `Stop` | marks the session end, session counter |

## 2. Dashboard

```sh
node cli/pt.mjs open            # open report.html of the current project
node cli/pt.mjs status          # text summary in the terminal
```

## 3. `/tracker` command

Installed at `~/.claude/commands/tracker.md` (global) — usage in Claude Code:

```
/tracker                    → current project summary
/tracker <project>          → any other tracked project
```

The command prints the bilingual summary and opens the dashboard. If a project's phases are all empty, it suggests running the git-history import (`tracker_import_git`).

## 4. MCP (optional, for tool access in any project)

```sh
claude mcp add project-tracker -- node C:/path/to/ai-project-tracker/mcp/server.mjs
```

Then the agent can call `tracker_note`, `tracker_summary`, `tracker_open`, `tracker_import_git`, ...

## 5. Manual hook config (equivalent to the installer)

`~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"C:/path/to/ai-project-tracker/hooks/claude-code/pt-hook.mjs\"" }] }
    ],
    "UserPromptSubmit": [ ... same ... ],
    "SessionStart": [ ... same ... ],
    "Stop": [ ... same ... ]
  }
}
```

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing recorded | Check `node hooks/claude-code/install.mjs --list` (or inspect `~/.claude/settings.json`), restart Claude Code |
| Hooks point to a moved path | Re-run the installer after moving the repo (absolute paths) |
| State not visible in opencode | Same project must be opened in both — the dashboard is per-project; both tools write `.opencode/project-tracker/state.json` |
| Want to keep only one tool | Remove the hooks (installer `--remove`) or the plugin entry — data files stay intact |