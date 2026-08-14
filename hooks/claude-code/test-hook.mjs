import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const G = "C:/Users/MG/AppData/Local/Temp/opencode/hook-global";
fs.rmSync(G, { recursive: true, force: true });
const root = "C:/Users/MG/AppData/Local/Temp/opencode/hook-proj";
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, "USL_PROGRESS.md"), `## Testing\n- [x] smoke test\n`);

const run = (payload) => new Promise((res) => {
  const p = spawn("node", [path.join(here, "pt-hook.mjs")], {
    cwd: root,
    env: { ...process.env, PT_GLOBAL_DIR: G, PT_NO_OPEN: "1" },
  });
  let err = "";
  p.stderr.on("data", (d) => (err += d));
  p.on("close", () => res(err));
  p.stdin.write(JSON.stringify(payload));
  p.stdin.end();
});

const checks = {};

/* SessionStart: seed picks up USL_PROGRESS.md */
await run({ hook_event_name: "SessionStart", cwd: root });
let s = JSON.parse(fs.readFileSync(path.join(root, ".opencode/project-tracker/state.json"), "utf8"));
checks["session start seeds progress"] = s.totals.seeded === 1;

/* PostToolUse Bash npm test -> testing phase + verified bonus */
await run({
  hook_event_name: "PostToolUse",
  cwd: root,
  tool_name: "Bash",
  tool_input: { command: "npm test" },
  tool_response: { stdout: "test result: ok. 7 passed; 0 failed" },
});
s = JSON.parse(fs.readFileSync(path.join(root, ".opencode/project-tracker/state.json"), "utf8"));
checks["bash test -> testing (+2 bonus, verified)"] = s.phases.testing.events === 2 && Math.abs(s.phases.testing.score - 4) < 0.001 && s.totals.verified === 1;

/* PostToolUse Write README.md -> docs */
await run({
  hook_event_name: "PostToolUse",
  cwd: root,
  tool_name: "Write",
  tool_input: { file_path: "docs/guide.md" },
  tool_response: { stdout: "wrote file" },
});
s = JSON.parse(fs.readFileSync(path.join(root, ".opencode/project-tracker/state.json"), "utf8"));
checks["write md -> docs"] = s.phases.docs.events === 1;

/* PostToolUse Bash failed command -> error */
await run({
  hook_event_name: "PostToolUse",
  cwd: root,
  tool_name: "Bash",
  tool_input: { command: "docker push x" },
  tool_response: { stderr: "error: denied: requested access" },
});
s = JSON.parse(fs.readFileSync(path.join(root, ".opencode/project-tracker/state.json"), "utf8"));
checks["denied push -> error counted, no bonus"] = s.totals.errors === 1 && s.totals.verified === 1;

/* UserPromptSubmit */
await run({ hook_event_name: "UserPromptSubmit", cwd: root, prompt: "ادامه بده" });
s = JSON.parse(fs.readFileSync(path.join(root, ".opencode/project-tracker/state.json"), "utf8"));
checks["user prompt counted"] = s.totals.messages === 1;

/* html exists */
checks["report.html exists"] = fs.existsSync(path.join(root, ".opencode/project-tracker/report.html"));

let ok = true;
for (const [k, v] of Object.entries(checks)) {
  console.log((v ? "PASS" : "FAIL") + "  " + k);
  if (!v) ok = false;
}
process.exit(ok ? 0 : 1);