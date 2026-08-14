# MCP server — setup per client

The MCP server (`mcp/server.mjs`) exposes the tracker's tools to any MCP-capable client: **Cursor, Windsurf, Cline, Claude Desktop, Claude Code, VS Code Copilot** and more. Zero dependencies — it runs with plain Node.js.

## One-command installer

From the repo directory:

```sh
node mcp/install.mjs                # registers in: Claude Code, Claude Desktop, Cursor, Windsurf
node mcp/install.mjs --vscode       # also register in the current workspace (VS Code Copilot)
node mcp/install.mjs --list         # show registration status
node mcp/install.mjs --remove       # remove all registrations
```

The installer is **merge-safe** (keeps your existing `mcpServers`), **idempotent** (safe to re-run) and **backs up** the target config to `*.pt-backup.json` before editing.

## Manual registration

The server entry is:

```
command:  node
args:     <absolute path to mcp/server.mjs>
```

### Cursor

Settings (`Cmd/Ctrl+Shift+P` → "Open MCP Config") → add:

```json
{
  "mcpServers": {
    "project-tracker": { "command": "node", "args": ["C:/path/to/ai-project-tracker/mcp/server.mjs"] }
  }
}
```

### Windsurf

Settings → MCP → Add server → same shape as Cursor.

### Cline (VS Code extension)

MCP Servers tab → "Add MCP Server" → type `stdio` → name `project-tracker` → command `node` → args `["C:/path/to/mcp/server.mjs"]`.

### Claude Desktop

`claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`, macOS: `~/Library/Application Support/Claude/`) →

```json
{
  "mcpServers": {
    "project-tracker": { "command": "node", "args": ["C:/path/to/ai-project-tracker/mcp/server.mjs"] }
  }
}
```

### Claude Code

```sh
claude mcp add project-tracker -- node C:/path/to/ai-project-tracker/mcp/server.mjs
```

or edit `~/.claude.json` → `"mcpServers"` with the same shape.

### VS Code Copilot

Workspace file `.vscode/mcp.json` (or user settings `mcp` section):

```json
{
  "servers": {
    "project-tracker": { "type": "stdio", "command": "node", "args": ["C:/path/to/ai-project-tracker/mcp/server.mjs"] }
  }
}
```

Restart the client after registering.

## Tools

| Tool | Description |
|---|---|
| `tracker_note` | Record a note: `{ text, type, phase?, weight? }` — types: success/error/warning/info/suggestion/solution/recommendation |
| `tracker_summary` | Bilingual progress summary: `{ project? }` (defaults to working directory) |
| `tracker_open` | Open a project's dashboard in the browser: `{ project? }` |
| `tracker_report` | Regenerate `report.html` / `report.md`: `{ project? }` |
| `tracker_init` | Initialize tracking: `{ project? }` |
| `tracker_list` | List all tracked projects |
| `tracker_import_git` | Backfill from git history: `{ project?, since? }` |

## Behavior notes

- The server uses its **working directory** as the project; pass `project: "name-or-path-fragment"` to target any tracked project (resolved against the global registry).
- Every tool call is also recorded in the project's timeline (tool calls counter).
- Project resolution is case-insensitive; unknown projects return an error with the tracked-project list.