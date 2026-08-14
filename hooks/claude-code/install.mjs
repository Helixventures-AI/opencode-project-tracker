#!/usr/bin/env node
/**
 * Install Claude Code hooks for the project tracker.
 *   node install.mjs            → global  (~/.claude/settings.json)
 *   node install.mjs --project  → project (.claude/settings.json)
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const hookFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "pt-hook.mjs");
const cmd = `node ${JSON.stringify(hookFile)}`;
const project = process.argv.includes("--project");
const settingsPath = project
  ? path.join(process.cwd(), ".claude", "settings.json")
  : path.join(os.homedir(), ".claude", "settings.json");

let settings = { hooks: {} };
try {
  if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
} catch {
  console.error("⚠️ existing settings.json is invalid JSON — aborting.");
  process.exit(1);
}
if (!settings.hooks || typeof settings.hooks !== "object") settings.hooks = {};

for (const ev of ["PostToolUse", "UserPromptSubmit", "SessionStart", "Stop"]) {
  settings.hooks[ev] = cmd;
}

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log(`✅ Claude Code hooks installed (${project ? "project" : "global"}): ${settingsPath}`);
console.log("   Restart Claude Code to apply. The tracker state lands in <project>/.opencode/project-tracker/");
console.log("   Dashboard:  npx pt open   (or open the report.html manually)");