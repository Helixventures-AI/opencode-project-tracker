#!/usr/bin/env node
/**
 * Claude Code hook for opencode-project-tracker.
 * Receives hook JSON on stdin (Claude Code invokes this command per event).
 * Events handled:
 *   PostToolUse       → record the tool call (auto-classified into a phase)
 *   UserPromptSubmit  → count user message
 *   SessionStart      → init + import progress files (seed)
 *   Stop              → final flush (writeNow)
 *
 * Install:  node install.mjs            → global (~/.claude/settings.json)
 *           node install.mjs --project  → project (.claude/settings.json)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createTracker } from "../../core/tracker-core.mjs";

const readJson = async () => {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
};

const outTextOf = (tr) => {
  if (tr == null) return "";
  if (typeof tr === "string") return tr;
  if (typeof tr === "object") {
    return String(tr.stdout ?? tr.output ?? tr.result ?? JSON.stringify(tr)).slice(0, 800);
  }
  return "";
};

const toolNameOf = (n) => {
  const s = String(n || "").toLowerCase();
  if (s.startsWith("mcp__")) return "mcp__" + s.replace(/^mcp__/, "");
  return s;
};

const main = async () => {
  const hook = await readJson();
  if (!hook) process.exit(0);

  const root = hook.cwd || process.cwd();
  if (!fs.existsSync(root)) process.exit(0);
  const tr = createTracker({ root });

  switch (hook.hook_event_name) {
    case "SessionStart":
      tr.init();
      break;
    case "PostToolUse": {
      const name = toolNameOf(hook.tool_name);
      const input = {
        command: hook.tool_input?.command || hook.tool_input?.command_line || hook.tool_input?.description || "",
        filePath: hook.tool_input?.file_path || hook.tool_input?.path || "",
        path: hook.tool_input?.file_path || hook.tool_input?.path || "",
      };
      tr.init();
      tr.recordTool(name, input, outTextOf(hook.tool_response));
      break;
    }
    case "UserPromptSubmit":
      tr.init();
      tr.chatMessage("user", hook.prompt || hook.tool_input?.prompt || "");
      break;
    case "Stop":
      tr.init();
      tr.writeNow();
      break;
    default:
      break;
  }
  process.exit(0);
};

main();