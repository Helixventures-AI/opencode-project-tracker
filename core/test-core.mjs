import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createTracker, classify, parseSeedFile, scanSeedFiles, effectivePhases, loadConfig } from "./tracker-core.mjs";

process.env.PT_NO_OPEN = "1";
const T = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "tmp-core-test");
const G = path.join(T, "global");
process.env.PT_GLOBAL_DIR = G;

const mk = (name) => {
  const root = path.join(T, name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root + "/.opencode/project-tracker", { recursive: true });
  return root;
};

const checks = {};

/* 1) recordTool basics + verified outcome + milestones */
let root = mk("proj-a");
let tr = createTracker({ root, globalDir: G });
tr.init();
tr.recordTool("edit", { filePath: root + "/a.ts" }, "ok");
tr.recordTool("bash", { command: "cargo test" }, "test result: ok. 15 passed; 0 failed");
tr.recordTool("bash", { command: "git commit -m x" }, "ok");
tr.recordTool("bash", { command: "docker push img" }, "Pushed successfully");
let s = JSON.parse(fs.readFileSync(tr.stateFile, "utf8"));
checks["edit lands in coding"] = s.phases.coding.events === 1;
checks["test ok bonus +2 (4 total in testing)"] = Math.abs(s.phases.testing.score - 4) < 0.001;
checks["verified=3 (test+commit+push)"] = s.totals.verified === 3;
checks["deploy bonus +2 (4.5)"] = Math.abs(s.phases.deploy.score - 4.5) < 0.001;
checks["milestones from 100%? overall<100 → no"] = JSON.stringify(s.milestones) === "[]";
checks["growth stored"] = typeof s.growth_rate_per_hour === "number";
checks["no duplicate stat label"] = !fs.readFileSync(path.join(root, ".opencode/project-tracker/report.html"), "utf8").includes("stat-fa") && fs.readFileSync(path.join(root, ".opencode/project-tracker/report.html"), "utf8").split('data-fa="عملیات ابزار"').length === 2;
checks["15 stat cards in html"] = (fs.readFileSync(path.join(root, ".opencode/project-tracker/report.html"), "utf8").match(/class="stat"/g) || []).length === 15;

/* 2) seed from JSON + MD + idempotent */
root = mk("proj-b");
fs.writeFileSync(path.join(root, "progress.json"), JSON.stringify([
  { id: "a", name: "step a", phase: "testing", status: "done", score: 2 },
  { id: "b", name: "step b", phase: "coding", status: "todo" },
]));
fs.writeFileSync(path.join(root, "USL_PROGRESS.md"), `## Testing\n- [x] run suite\n## Deploy\n- [x] go live\n- [ ] later (phase: docs)\n`);
tr = createTracker({ root, globalDir: G });
tr.init();
s = JSON.parse(fs.readFileSync(tr.stateFile, "utf8"));
checks["seeded=3 (2 json + 2 md - 1 todo)"] = s.totals.seeded === 3;
checks["idempotent after re-init"] = (() => { tr.init(); return JSON.parse(fs.readFileSync(tr.stateFile, "utf8")).totals.seeded === 3 })();
checks["md todo registers docs phase w/o points"] = (() => { const st = JSON.parse(fs.readFileSync(tr.stateFile, "utf8")); return st.phases.docs.events === 1 && st.phases.docs.score === 0 })();

/* 3) corrupt state -> backup + warning */
root = mk("proj-c");
fs.writeFileSync(path.join(root, ".opencode/project-tracker/state.json"), "{{{ NOPE");
tr = createTracker({ root, globalDir: G });
tr.init();
s = JSON.parse(fs.readFileSync(tr.stateFile, "utf8"));
const backups = fs.readdirSync(path.join(root, ".opencode/project-tracker")).filter((f) => f.includes(".corrupt-"));
checks["corrupt -> fresh"] = s.totals.tool_calls === 0;
checks["backup created"] = backups.length === 1;
checks["warning issue"] = s.issues.some((i) => i.msg.includes("state.json خراب"));

/* 4) chatMessage assistant capture + cap */
root = mk("proj-d");
tr = createTracker({ root, globalDir: G });
tr.init();
for (let i = 1; i <= 3; i++) tr.chatMessage("assistant", [{ type: "text", text: `گام ${i} انجام شد` }]);
tr.chatMessage("user", "ادامه بده");
s = JSON.parse(fs.readFileSync(tr.stateFile, "utf8"));
checks["assistant_messages=3"] = s.totals.assistant_messages === 3;
checks["chat_log has persian"] = s.chat_log[0].text.includes("گام 3");
checks["user messages=1"] = s.totals.messages === 1;

/* 5) note tool + suggestions */
tr.note("success", "deploy verified on staging");
tr.note("suggestion", "use lockfile");
s = JSON.parse(fs.readFileSync(tr.stateFile, "utf8"));
checks["note success -> verified+1"] = s.totals.verified === 1;
checks["suggestion counted"] = s.totals.suggestions === 1;

/* 6) registry + resolve + open */
const rootB = mk("proj-other");
fs.mkdirSync(path.join(rootB, ".opencode/project-tracker"), { recursive: true });
fs.writeFileSync(path.join(rootB, ".opencode/project-tracker/report.html"), "<html>ok</html>");
const tr2 = createTracker({ root: rootB, globalDir: G });
tr2.init();
const o1 = tr.open("proj-other");
const o2 = tr.open("nope");
checks["open by name resolves"] = o1.ok && o1.message.includes("proj-other");
checks["open unknown -> error+list"] = !o2.ok && o2.message.includes("proj-other");
checks["list has both"] = tr.list().length >= 2;

/* 7) summary text */
const sum = tr.summary();
checks["summary has phase table"] = sum.includes("| Phase |") && sum.includes("Tool calls:");
checks["summary bilingual"] = sum.includes("پیشرفت") || sum.includes("Active phase");

/* 8) classify claude names */
checks["claude Write -> docs for md"] = classify("Write", { file_path: "x/README.md" }).phase === "docs";
checks["claude Bash test -> testing"] = classify("Bash", { command_line: "npm test" }).phase === "testing";
checks["claude Read -> research"] = classify("Read", { file_path: "x.ts" }).phase === "research";
checks["mcp__ tool -> coding"] = classify("mcp__docker_exec", {}).phase === "coding";

/* 9) config goals override */
root = mk("proj-e");
fs.writeFileSync(path.join(root, ".opencode/project-tracker/config.json"), JSON.stringify({ goals: { coding: 90 } }));
tr = createTracker({ root, globalDir: G });
tr.init();
checks["config goal applied"] = tr.phases.find((p) => p.key === "coding").goal === 90;

let ok = true;
for (const [k, v] of Object.entries(checks)) {
  console.log((v ? "PASS" : "FAIL") + "  " + k);
  if (!v) ok = false;
}
console.log("tested:", Object.keys(checks).length);
process.exit(ok ? 0 : 1);