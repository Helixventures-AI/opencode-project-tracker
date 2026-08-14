#!/usr/bin/env node
/**
 * Universal MCP installer for the project tracker.
 * Registers a "project-tracker" stdio MCP server (node mcp/server.mjs) in:
 *
 *   Claude Code         ~/.claude.json                       (global)
 *   Claude Desktop      %APPDATA%/Claude/claude_desktop_config.json (global)
 *   Cursor              ~/.cursor/mcp.json                   (global)
 *   Windsurf            ~/.codeium/windsurf/mcp_config.json  (global)
 *   VS Code Copilot     .vscode/mcp.json  (current workspace, --vscode)
 *
 * Merge-safe: existing settings are preserved, idempotent, backs up before edit.
 *
 * Usage:
 *   node mcp/install.mjs              → all global clients
 *   node mcp/install.mjs --vscode     → also register in the current workspace
 *   node mcp/install.mjs --list       → show registrations only
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const serverFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "server.mjs");
const entry = () => ({ command: "node", args: [serverFile] });

const TARGETS = [
  { name: "Claude Code",      file: () => path.join(os.homedir(), ".claude.json"), key: "mcpServers" },
  { name: "Claude Desktop",   file: () => path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json"), key: "mcpServers" },
  { name: "Cursor",           file: () => path.join(os.homedir(), ".cursor", "mcp.json"), key: "mcpServers" },
  { name: "Windsurf",         file: () => path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"), key: "mcpServers" },
];

const readJson = (file) => {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
};

const listOnly = process.argv.includes("--list");
const withVscode = process.argv.includes("--vscode");

let changed = false;

for (const t of TARGETS) {
  const file = t.file();
  if (listOnly) {
    const j = readJson(file);
    console.log(`${t.name}: ${j && j[t.key] && j[t.key]["project-tracker"] ? "registered ✔" : (j === null ? "INVALID JSON" : "not registered")}  → ${file}`);
    continue;
  }
  let j = readJson(file);
  if (j === null) { console.log(`⚠️ ${t.name}: ${file} is invalid JSON — skipped.`); continue; }
  if (j[t.key] && j[t.key]["project-tracker"]) { console.log(`✔ ${t.name}: already registered → ${file}`); continue; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, file + ".pt-backup.json");
  j[t.key] = j[t.key] || {};
  j[t.key]["project-tracker"] = entry();
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
  console.log(`✅ ${t.name}: registered → ${file}`);
  changed = true;
}

if (withVscode && !listOnly) {
  const file = path.join(process.cwd(), ".vscode", "mcp.json");
  let j = readJson(file);
  if (j === null) { console.log(`⚠️ VS Code (${file}): invalid JSON — skipped.`); }
  else if (j.mcpServers && j.mcpServers["project-tracker"]) {
    console.log(`✔ VS Code Copilot: already registered → ${file}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) fs.copyFileSync(file, file + ".pt-backup.json");
    j.mcpServers = j.mcpServers || {};
    j.mcpServers["project-tracker"] = entry();
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    console.log(`✅ VS Code Copilot: registered → ${file}`);
    changed = true;
  }
}

if (listOnly) {
  const cc = readJson(path.join(os.homedir(), ".claude.json"));
  const ok = cc && cc.mcpServers && cc.mcpServers["project-tracker"];
  console.log(`\nClaude Code MCP status: ${ok ? "registered" : "not registered"}`);
  console.log("Restart the client to pick up the new MCP server.");
  process.exit(ok ? 0 : 1);
}

if (changed) console.log("\nRestart the clients to pick up the new MCP server.");
else console.log("\nNothing to change.");