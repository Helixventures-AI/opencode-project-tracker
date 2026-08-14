/**
 * ai-project-tracker PRO — team.mjs
 * Aggregates all tracked projects (from the global registry) into one team.html:
 * per-project overall %, growth, ETA, active phase, verified, milestones.
 * Zero dependencies, fully local.
 */

import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const REGISTRY = path.join(os.homedir(), ".config", "opencode", "project-tracker", "projects.json")
const PHASE_KEYS = ["research", "setup", "coding", "testing", "docs", "deploy", "delivery"]

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}
function round(n, d = 1) {
  return Math.round(n * 10 ** d) / 10 ** d
}
function pctColor(p) {
  return p >= 100 ? "#34d399" : p >= 75 ? "#38bdf8" : p >= 50 ? "#fbbf24" : p >= 25 ? "#f472b6" : "#fb7185"
}
function relTime(ts) {
  if (!ts) return "—"
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export function loadProjects(registryPath = REGISTRY) {
  if (!fs.existsSync(registryPath)) return []
  try {
    return JSON.parse(fs.readFileSync(registryPath, "utf8"))
  } catch {
    return []
  }
}

export function loadProjectState(dir) {
  const p = path.join(dir, ".opencode", "project-tracker", "state.json")
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"))
  } catch {
    return null
  }
}

export function buildTeam(projects = loadProjects()) {
  const rows = []
  for (const pr of projects) {
    const st = pr.dir ? loadProjectState(pr.dir) : null
    rows.push({
      id: pr.id,
      dir: pr.dir,
      pct: st ? round(st.overall_pct ?? pr.pct ?? 0) : round(pr.pct ?? 0),
      growth: st ? round(st.growth_rate_per_hour ?? 0) : null,
      eta: st?.eta_minutes ? Math.round(st.eta_minutes) : null,
      verified: st?.totals?.verified ?? null,
      tests: st?.totals?.tests ?? null,
      errors: st?.totals?.errors ?? null,
      updated: st?.updated_at ?? pr.updated_at,
      active: st ? Object.entries(st.phases || {}).find(([, ph]) => ph.active)?.[0] : null,
      milestones: st ? (st.milestones || []) : [],
      hasState: !!st,
    })
  }
  rows.sort((a, b) => b.pct - a.pct)

  const cards = rows.map((r) => {
    const ms = (r.milestones || []).map((m) => `<span class="ms-chip ${m >= 100 ? "" : "dim"}">${m}%</span>`).join("")
    return `<div class="card">
  <div class="row"><b>${esc(r.id)}</b><span class="g">${r.hasState ? "" : "⚠️ no state"}</span></div>
  <div class="bar"><div class="fill" style="width:${r.pct}%;background:${pctColor(r.pct)}"></div></div>
  <div class="meta">
    <span class="pct" style="color:${pctColor(r.pct)}">${r.pct}%</span>
    <span>⚡ ${r.growth ?? "—"} pts/h</span>
    <span>⏱️ ${r.eta != null ? r.eta + " min" : "—"}</span>
    <span>⭐ ${r.verified ?? "—"}</span>
    <span>🧪 ${r.tests ?? "—"}</span>
    <span>❌ ${r.errors ?? "—"}</span>
    <span>🕒 ${relTime(r.updated)}</span>
  </div>
  <div class="meta2">${r.active ? `🧭 ${esc(r.active)}` : "🧭 —"} ${ms ? `<span>🏆 ${ms}</span>` : ""}</div>
  ${r.dir ? `<div class="dir">${esc(r.dir)}</div>` : ""}
</div>`
  }).join("\n")

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Team dashboard — ai-project-tracker PRO</title>
<style>
:root{--bg1:#0b0f1f;--bg2:#151a35;--txt:#e2e8f0;--muted:#94a3b8;--acc:#22d3ee}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:var(--txt);background:linear-gradient(160deg,var(--bg1),var(--bg2));min-height:100vh;padding:28px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;color:var(--muted);font-weight:500;margin:0 0 18px}
.wrap{max-width:980px;margin:0 auto}
.card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:16px;margin-bottom:14px}
.row{display:flex;justify-content:space-between;align-items:center;font-size:14px}
.row b{font-size:14px}.g{color:#fbbf24;font-size:11px}
.bar{height:8px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;margin:10px 0 8px}
.fill{height:100%}.meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted)}
.meta .pct{font-weight:800;font-size:15px}.meta2{margin-top:8px;font-size:12px;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap}
.ms-chip{font-size:10.5px;padding:2px 9px;border-radius:99px;border:1px solid var(--acc);color:var(--acc)}
.ms-chip.dim{opacity:.35}
.dir{font-size:10.5px;color:var(--muted);opacity:.7;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
footer{margin-top:18px;text-align:center;color:var(--muted);font-size:11.5px}
</style></head>
<body><div class="wrap">
<h1>👥 Team dashboard</h1><h2>${rows.length} tracked projects · ai-project-tracker PRO</h2>
${cards || "<p>No projects tracked yet.</p>"}
<footer>Generated ${new Date().toISOString()}</footer>
</div></body></html>`
}

export function writeTeam(outPath = "team.html") {
  const html = buildTeam()
  fs.writeFileSync(outPath, html, "utf8")
  return outPath
}