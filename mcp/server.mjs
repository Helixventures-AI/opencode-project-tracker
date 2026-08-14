#!/usr/bin/env node
/**
 * opencode-project-tracker — MCP server (Model Context Protocol, stdio)
 * Zero npm dependencies. Works with any MCP-capable client:
 * Cursor, Windsurf, Cline, Claude Desktop, VS Code Copilot, Cherry Studio, ...
 *
 * Run: node server.mjs   (register as a stdio MCP server)
 * Env:  PT_GLOBAL_DIR  (optional, default ~/.config/opencode/project-tracker)
 *       PT_NO_OPEN=1   (tests only — never spawn a browser)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createTracker, summaryText, VERSION } from "../core/tracker-core.mjs";

const serverInfo = { name: "opencode-project-tracker", version: VERSION };
let protocolVersion = "2025-06-18";

const TOOLS = [
  {
    name: "tracker_note",
    description: "Record a short progress note (bug found, error, success, decision, suggestion or solution).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Short note, max ~140 characters" },
        type: { type: "string", description: "success | error | warning | info | suggestion | solution | recommendation", enum: ["success", "error", "warning", "info", "suggestion", "solution", "recommendation"] },
        project: { type: "string", description: "Optional: project name or path fragment (default: server working directory)" },
      },
      required: ["text"],
    },
  },
  {
    name: "tracker_summary",
    description: "Bilingual (FA/EN) progress summary of a project: overall %, milestones, growth, ETA, phase table, totals.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Optional: project name or path fragment (default: server working directory)" },
      },
    },
  },
  {
    name: "tracker_open",
    description: "Open the HTML dashboard (report.html) of a project in the browser.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Optional: project name or path fragment (default: server working directory)" },
      },
    },
  },
  {
    name: "tracker_report",
    description: "Re-import progress files (USL_PROGRESS.md, progress*.json, ROADMAP*) and regenerate report.html + report.md.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Optional: project name or path fragment (default: server working directory)" },
      },
    },
  },
  {
    name: "tracker_init",
    description: "Initialize progress tracking for a directory (creates state.json/report.html/report.md and registers the project).",
    inputSchema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Absolute path of the project directory" },
      },
      required: ["dir"],
    },
  },
  {
    name: "tracker_list",
    description: "List all tracked projects (id, progress %, directory).",
    inputSchema: { type: "object", properties: {} },
  },
];

const resolveTracker = (args) => {
  const q = args?.project;
  const base = createTracker({ root: process.cwd() });
  if (q) {
    const dir = base.resolveProject(q);
    if (!dir) {
      const list = base.list().map((o) => o.id).join("، ") || "(هیچ)";
      return { error: `پروژهٔ «${q}» یافت نشد. پروژه‌های ثبت‌شده: ${list}` };
    }
    const tr = createTracker({ root: dir });
    tr.init();
    return tr;
  }
  base.init();
  return base;
};

const callTool = async (name, args = {}) => {
  switch (name) {
    case "tracker_note": {
      if (!args.text) return { error: "text is required" };
      const tr = resolveTracker(args);
      if (tr.error) return tr;
      const r = tr.note(args.type || "info", args.text);
      return r.ok ? { text: "✅ Note recorded." } : { error: r.error || "note failed" };
    }
    case "tracker_summary": {
      const tr = resolveTracker(args);
      if (tr.error) return tr;
      return { text: summaryText(tr.state, tr.phases) };
    }
    case "tracker_open": {
      const tr = resolveTracker(args);
      if (tr.error) return tr;
      const r = tr.open(args.project || undefined);
      return r.ok ? { text: `✅ ${r.message}` } : { error: r.message };
    }
    case "tracker_report": {
      const tr = resolveTracker(args);
      if (tr.error) return tr;
      tr.init();
      return { text: `✅ Dashboard regenerated for «${tr.state.project}» — overall ${tr.state.overall_pct}%, milestones ${tr.state.milestones.join(", ") || "—"}` };
    }
    case "tracker_init": {
      if (!args.dir) return { error: "dir is required" };
      if (!fs.existsSync(args.dir)) return { error: `path does not exist: ${args.dir}` };
      const tr = createTracker({ root: args.dir });
      tr.init();
      return { text: `✅ Tracker initialized for «${tr.state.project}»` };
    }
    case "tracker_list": {
      const tr = createTracker({ root: process.cwd() });
      const rows = tr.list();
      if (!rows.length) return { text: "(no tracked projects yet)" };
      return { text: rows.map((o) => `- ${o.id}  ${o.pct}%  ${o.dir}`).join("\n") };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
};

const readlineAsync = async () => {
  const rl = (await import("node:readline")).createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const { id, method, params } = msg;
    if (method === "initialize") {
      protocolVersion = params?.protocolVersion || protocolVersion;
      respond(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
        serverInfo,
      });
      continue;
    }
    if (!method) continue; // response (we are server, none expected)
    if (method === "notifications/initialized" || method === "notifications/cancelled") continue;
    if (method === "ping") { respond(id, {}); continue; }
    if (method === "tools/list") {
      respond(id, { tools: TOOLS });
      continue;
    }
    if (method === "tools/call") {
      const { name, arguments: args } = params || {};
      const out = await callTool(name, args || {});
      if (out.error) {
        respond(id, { content: [{ type: "text", text: out.error }], isError: true });
      } else {
        respond(id, { content: [{ type: "text", text: out.text }] });
      }
      continue;
    }
    if (method === "resources/list") { respond(id, { resources: [] }); continue; }
    if (method === "resources/read") { respond(id, { contents: [] }); continue; }
    if (method === "prompts/list") { respond(id, { prompts: [] }); continue; }
    respondError(id, -32601, `method not found: ${method}`);
  }
};

const respond = (id, result) => {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
};
const respondError = (id, code, message) => {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
};

readlineAsync().catch((e) => {
  process.stderr.write("mcp server error: " + String(e) + "\n");
  process.exit(1);
});