#!/usr/bin/env node
/**
 * ai-project-tracker PRO — CLI entry.
 *
 * License: a valid key unlocks all Pro commands.
 *   - env AIPT_PRO_KEY=<key>            or
 *   - file ~/.config/ai-project-tracker/pro.license   (one line, the key)
 *
 * Commands:
 *   node pro/pro.mjs status                    → license + feature status
 *   node pro/pro.mjs team [out.html]           → team dashboard (all tracked projects)
 *   node pro/pro.mjs export <project-dir> --csv|--print|--rollup [out]
 *   node pro/pro.mjs brand <theme.json> [report.html]
 */
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { verifyKey } from "./license.mjs"
import { applyBrand } from "./brand.mjs"
import { exportCSV, exportRollup, exportPrintHTML } from "./export.mjs"
import { loadProjects, loadProjectState, writeTeam } from "./team.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const PRO_VERSION = "1.0.0-pro"

function getLicense() {
  const fromEnv = process.env.AIPT_PRO_KEY
  const file = path.join(os.homedir(), ".config", "ai-project-tracker", "pro.license")
  const fromFile = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : null
  return verifyKey(fromEnv || fromFile)
}

function requireLicense() {
  const v = getLicense()
  if (!v.ok) {
    console.error(`❌ Pro feature locked (${v.reason}).
Get a license at https://gumroad.com/ai-project-tracker (placeholder), then:
  set AIPT_PRO_KEY=<key>   or   put the key in ~/.config/ai-project-tracker/pro.license`)
    process.exit(2)
  }
  return v.payload
}

function readState(project) {
  const p = path.resolve(project)
  const file = path.join(p, ".opencode", "project-tracker", "state.json")
  if (!fs.existsSync(file)) {
    console.error(`❌ No state found in ${p}`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

const [cmd, a, b] = process.argv.slice(2)

if (cmd === "status") {
  const v = getLicense()
  console.log(`ai-project-tracker PRO ${PRO_VERSION}`)
  console.log("License:", v.ok ? `✅ valid (${v.payload.tier}, exp ${v.payload.exp.slice(0, 10)})` : `❌ ${v.reason}`)
  console.log("Features: team dashboard, branding, advanced export")
} else if (cmd === "team") {
  requireLicense()
  const out = writeTeam(a || "team.html")
  console.log(`✅ team.html written (${loadProjects().length} projects) → ${out}`)
} else if (cmd === "export") {
  requireLicense()
  const args = process.argv.slice(2).slice(1)
  const project = args.find((x) => !x.startsWith("--"))
  const mode = (args.find((x) => x.startsWith("--")) || "--csv").replace(/^--/, "")
  const outName = args.filter((x) => x.startsWith("--")).length
    ? args[args.length - 1].startsWith("--") ? `export.${mode === "print" ? "html" : mode === "rollup" ? "md" : "csv"}` : args[args.length - 1]
    : `export.${mode === "print" ? "html" : mode === "rollup" ? "md" : "csv"}`
  if (!project) { console.error("Usage: node pro/pro.mjs export <project-dir> --csv|--print|--rollup [out]"); process.exit(1) }
  const state = readState(project)
  const content = mode === "print" ? exportPrintHTML(state) : mode === "rollup" ? exportRollup(state) : exportCSV(state)
  fs.writeFileSync(outName, content, "utf8")
  console.log(`✅ export written → ${outName}`)
} else if (cmd === "brand") {
  requireLicense()
  if (!a) { console.error("Usage: node pro/pro.mjs brand <theme.json> [report.html]"); process.exit(1) }
  const theme = JSON.parse(fs.readFileSync(path.resolve(a), "utf8"))
  const target = path.resolve(b || "report.html")
  const html = fs.readFileSync(target, "utf8")
  fs.writeFileSync(target, applyBrand(html, theme), "utf8")
  console.log(`✅ branding applied → ${target}`)
} else {
  console.log(`ai-project-tracker PRO ${PRO_VERSION}
Usage:
  node pro/pro.mjs status
  node pro/pro.mjs team [out.html]
  node pro/pro.mjs export <project-dir> --csv|--print|--rollup [out]
  node pro/pro.mjs brand <theme.json> [report.html]`)
}