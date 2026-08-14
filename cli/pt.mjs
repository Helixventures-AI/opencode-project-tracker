#!/usr/bin/env node
/**
 * pt — Project Tracker CLI (works on any platform incl. web AI environments)
 * Usage:
 *   pt init [dir]                      initialize tracking for a directory
 *   pt status [dir|project]            bilingual progress summary
 *   pt note <type> <text>              record a note (success/error/warning/info/suggestion/solution/recommendation)
 *   pt report [dir|project]            regenerate dashboard (html+md) after progress files changed
 *   pt open [project]                  open the dashboard in the browser
 *   pt list                            list all tracked projects
 *   pt import-git [--since "2 weeks ago"]  import git history into phases (idempotent)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createTracker, summaryText, VERSION } from "../core/tracker-core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const help = () => {
  console.log(`pt v${VERSION} — Project Tracker CLI
Usage: pt <command> [args]
  init [dir]            initialize tracking for a directory (default: current dir)
  status [dir|project]  show bilingual progress summary
  note <type> <text>    record a note (types: success, error, warning, info, suggestion, solution, recommendation)
  report [dir|project]  regenerate dashboard + report after editing progress files
  open [project]        open the dashboard in the browser (default: current project)
  list                  list all tracked projects
  import-git [since]    import git history into phases (idempotent; optional git-log since, e.g. "2 weeks ago")`);
};

const argToDir = (a) => {
  if (!a) return process.cwd();
  if (fs.existsSync(a)) return fs.realpathSync(a);
  return a; // project name/fragment — resolved via registry later
};

const main = async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") return help();
  const first = rest[0] || "";

  switch (cmd) {
    case "init": {
      const dir = argToDir(first);
      const tr = createTracker({ root: dir });
      tr.init();
      console.log(`✅ Tracker initialized for «${tr.state.project}»`);
      console.log(`   state.json / report.html / report.md → ${path.join(dir, ".opencode", "project-tracker")}`);
      console.log(`   Next: pt status · pt open`);
      break;
    }
    case "status": {
      if (first) {
        const tr = createTracker({ root: process.cwd() });
        const resolved = tr.resolveProject(first);
        if (!resolved) {
          console.log(`پروژهٔ «${first}» یافت نشد. پروژه‌های ثبت‌شده:`);
          for (const o of tr.list()) console.log(`  - ${o.id} (${o.pct}%)`);
          process.exit(1);
        }
        const tr2 = createTracker({ root: resolved });
        tr2.init();
        console.log(summaryText(tr2.state, tr2.phases));
      } else {
        const tr = createTracker({ root: process.cwd() });
        tr.init();
        console.log(summaryText(tr.state, tr.phases));
      }
      break;
    }
    case "note": {
      const type = first || "info";
      let phase, weight;
      const words = rest.slice(1);
      const textParts = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w === "--phase") { phase = words[++i]; continue; }
        if (w === "--weight") { weight = Number(words[++i]); continue; }
        if (w.startsWith("--phase=")) { phase = w.slice(8); continue; }
        if (w.startsWith("--weight=")) { weight = Number(w.slice(9)); continue; }
        textParts.push(w);
      }
      const text = textParts.join(" ");
      if (!text) { console.error("usage: pt note <type> <text> [--phase <phase>] [--weight <n>]"); process.exit(1); }
      const tr = createTracker({ root: process.cwd() });
      tr.init();
      const r = tr.note(type, text, { phase, weight });
      if (!r.ok) { console.error("error:", r.error); process.exit(1); }
      console.log(`✅ Note recorded (${type})${weight > 0 ? ` — ${phase || "active phase"}: +${weight}` : ""}`);
      break;
    }
    case "report": {
      const tr = createTracker({ root: argToDir(first) });
      tr.init();
      console.log(`✅ Dashboard regenerated for «${tr.state.project}»`);
      console.log(`   overall: ${tr.state.overall_pct}% · milestones: ${tr.state.milestones.join(", ") || "—"}`);
      console.log(`   report.html → ${path.join(tr.dir, ".opencode", "project-tracker", "report.html")}`);
      break;
    }
    case "open": {
      const tr = createTracker({ root: process.cwd() });
      tr.init();
      const r = tr.open(first || undefined);
      console.log(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`);
      if (!r.ok) process.exit(1);
      break;
    }
    case "list": {
      const tr = createTracker({ root: process.cwd() });
      const rows = tr.list();
      if (!rows.length) { console.log("(no tracked projects yet — run `pt init`)"); break; }
      for (const o of rows) console.log(`  ${o.id}  ${o.pct}%  ${o.dir}`);
      break;
    }
    case "import-git": {
      const dir = process.cwd();
      const gitArgs = ["log", "--pretty=format:%H|%ct|%s", "--all"];
      if (first) gitArgs.push("--since", first);
      const g = spawnSync("git", gitArgs, { cwd: dir, encoding: "utf8" });
      if (g.error || g.status !== 0) {
        console.error(`❌ git log failed (is «${dir}» a git repo?): ${(g.stderr || "").trim().slice(0, 200)}`);
        process.exit(1);
      }
      const commits = String(g.stdout || "")
        .split("\n").filter(Boolean)
        .map((line) => { const [hash, ts, ...rest] = line.split("|"); return { hash, ts, subject: rest.join("|") }; });
      const tr = createTracker({ root: dir });
      tr.init();
      const r = tr.importGitCommits(commits);
      if (!r.ok) { console.error("❌", r.error); process.exit(1); }
      console.log(`✅ Imported ${r.imported} commit${r.imported === 1 ? "" : "s"} into phases${r.skipped ? ` (${r.skipped} already imported — idempotent)` : ""}`);
      console.log(`   overall: ${tr.state.overall_pct}% · milestones: ${tr.state.milestones.join(", ") || "—"} · total score: ${r.total}`);
      console.log(`   Next: pt status · pt open`);
      break;
    }
    default:
      console.error(`unknown command: ${cmd}`);
      help();
      process.exit(1);
  }
};

main();