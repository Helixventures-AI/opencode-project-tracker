import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const G = "C:/Users/MG/AppData/Local/Temp/opencode/mcp-global";
fs.rmSync(G, { recursive: true, force: true });

const rootA = "C:/Users/MG/AppData/Local/Temp/opencode/mcp-proj-a";
const rootB = "C:/Users/MG/AppData/Local/Temp/opencode/mcp-proj-b";
fs.rmSync(rootA, { recursive: true, force: true });
fs.rmSync(rootB, { recursive: true, force: true });
fs.mkdirSync(rootA, { recursive: true });
fs.mkdirSync(rootB, { recursive: true });
fs.writeFileSync(path.join(rootB, "progress.json"), JSON.stringify([
  { id: "x", name: "step x", phase: "coding", status: "done", score: 10 },
]));

const proc = spawn("node", [path.join(here, "..", "mcp", "server.mjs")], {
  cwd: rootA,
  env: { ...process.env, PT_GLOBAL_DIR: G, PT_NO_OPEN: "1" },
  stdio: ["pipe", "pipe", "inherit"],
});

let idc = 0;
const pending = new Map();
let buf = "";
proc.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch { /* noop */ }
  }
});

const send = (method, params) => new Promise((res) => {
  const id = ++idc;
  pending.set(id, res);
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(300);

const checks = {};

const init = await send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
checks["initialize ok + server info"] = init.result?.serverInfo?.name === "opencode-project-tracker" && !!init.result?.protocolVersion;

const tools = await send("tools/list", {});
const names = tools.result.tools.map((t) => t.name);
checks["tools/list has 7 tools"] = ["tracker_note", "tracker_summary", "tracker_open", "tracker_report", "tracker_init", "tracker_list", "tracker_import_git"].every((n) => names.includes(n));

const note = await send("tools/call", { name: "tracker_note", arguments: { text: "deploy verified", type: "success" } }); // cwd = mcp-proj-a
checks["tracker_note ok"] = !note.result?.isError && note.result?.content?.[0]?.text?.includes("✅");

const init2 = await send("tools/call", { name: "tracker_init", arguments: { dir: rootB } });
checks["tracker_init ok"] = !init2.result?.isError && init2.result?.content?.[0]?.text?.includes("mcp-proj-b");

const sumB = await send("tools/call", { name: "tracker_summary", arguments: { project: "mcp-proj-b" } });
checks["tracker_summary resolves other project + seeded"] = !sumB.result?.isError && sumB.result?.content?.[0]?.text?.includes("mcp-proj-b") && sumB.result?.content?.[0]?.text?.includes("📥 1");

const sumA = await send("tools/call", { name: "tracker_summary", arguments: {} });
checks["tracker_summary default = cwd project"] = sumA.result?.content?.[0]?.text?.includes("mcp-proj-a");

const bad = await send("tools/call", { name: "tracker_summary", arguments: { project: "nope-xyz" } });
checks["unknown project -> isError + list"] = bad.result?.isError === true && bad.result?.content?.[0]?.text?.includes("یافت نشد");

const list = await send("tools/call", { name: "tracker_list", arguments: {} });
checks["tracker_list has both"] = list.result?.content?.[0]?.text?.includes("mcp-proj-a") && list.result?.content?.[0]?.text?.includes("mcp-proj-b");

const unknown = await send("tools/call", { name: "no_such", arguments: {} });
checks["unknown tool -> isError"] = unknown.result?.isError === true;

const ping = await send("ping", {});
checks["ping ok"] = ping.result && ping.id > 0;

const p2 = await send("tools/call", { name: "tracker_report", arguments: { project: "mcp-proj-b" } });
checks["tracker_report regenerates"] = !p2.result?.isError && p2.result?.content?.[0]?.text?.includes("Dashboard regenerated") && p2.result?.content?.[0]?.text?.includes("mcp-proj-b");

const stB = JSON.parse(fs.readFileSync(path.join(rootB, ".opencode/project-tracker/state.json"), "utf8"));
checks["note landed in A (cwd)"] = JSON.parse(fs.readFileSync(path.join(rootA, ".opencode/project-tracker/state.json"), "utf8")).totals.verified === 1;
checks["B seeded from progress.json"] = stB.totals.seeded === 1;

/* tracker_import_git — build a real git repo in a new dir */
const rootC = "C:/Users/MG/AppData/Local/Temp/opencode/mcp-proj-c";
fs.rmSync(rootC, { recursive: true, force: true });
fs.mkdirSync(rootC, { recursive: true });
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const sh = (cmd, args, cwd) => new Promise((res) => {
  const p = spawn(cmd, args, { cwd, env: gitEnv, stdio: ["ignore", "ignore", "ignore"] });
  p.on("close", () => res());
});
await sh("git", ["init"], rootC);
fs.writeFileSync(path.join(rootC, "c.txt"), "x");
await sh("git", ["add", "."], rootC);
await sh("git", ["commit", "-m", "feat: initial"], rootC);
fs.writeFileSync(path.join(rootC, "c.txt"), "y");
await sh("git", ["add", "."], rootC);
await sh("git", ["commit", "-m", "test: verify"], rootC);
const initC = await send("tools/call", { name: "tracker_init", arguments: { dir: rootC } });
const impC = await send("tools/call", { name: "tracker_import_git", arguments: { project: "mcp-proj-c" } });
checks["tracker_import_git: imports commits"] = !impC.result?.isError && impC.result?.content?.[0]?.text?.includes("Imported 2 git commits");
const stC = JSON.parse(fs.readFileSync(path.join(rootC, ".opencode/project-tracker/state.json"), "utf8"));
checks["tracker_import_git: phases filled"] = stC.totals.commits === 2 && stC.totals.verified >= 2 && (stC.phases.coding.score + stC.phases.testing.score) > 0;
const impC2 = await send("tools/call", { name: "tracker_import_git", arguments: { project: "mcp-proj-c" } });
checks["tracker_import_git: idempotent"] = !impC2.result?.isError && impC2.result?.content?.[0]?.text?.includes("0 git commits");
const impBad = await send("tools/call", { name: "tracker_import_git", arguments: { project: "nope-xyz" } });
checks["tracker_import_git: unknown -> error"] = impBad.result?.isError === true;

let ok = true;
for (const [k, v] of Object.entries(checks)) {
  console.log((v ? "PASS" : "FAIL") + "  " + k);
  if (!v) ok = false;
}
if (!ok) {
  console.log("--- debug: sumB:", JSON.stringify(sumB).slice(0, 300));
  console.log("--- debug: note:", JSON.stringify(note).slice(0, 200));
}
proc.kill();
process.exit(ok ? 0 : 1);