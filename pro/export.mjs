/**
 * ai-project-tracker PRO — export.mjs
 * Advanced exports: CSV stats, weekly/monthly rollup, print-ready bundle.
 * Zero dependencies.
 */

function round(n, d = 1) {
  return Math.round(n * 10 ** d) / 10 ** d
}

const PHASE_KEYS = ["research", "setup", "coding", "testing", "docs", "deploy", "delivery"]
const DEFAULT_GOALS = { research: 15, setup: 15, coding: 60, testing: 30, docs: 15, deploy: 20, delivery: 10 }

export function exportCSV(state) {
  const p = state.phases || {}
  const t = state.totals || {}
  const lines = []
  lines.push("project,phase,score,goal,percent,events,status")
  lines.push(`"${state.project || ""}","__overall__",${round(state.overall_pct ?? 0)},100,${round(state.overall_pct ?? 0)},0,""`)
  for (const key of PHASE_KEYS) {
    const ph = p[key]
    if (!ph) continue
    const goal = ph.goal ?? DEFAULT_GOALS[key] ?? 1
    lines.push(`"${state.project || ""}",${key},${round(ph.score)},${goal},${round((ph.score / goal) * 100)},${ph.events ?? 0},${ph.active ? "active" : ""}`)
  }
  lines.push(`"${state.project || ""}",__totals__,0,0,0,0,"verified=${t.verified ?? 0}; tests=${t.tests ?? 0}; errors=${t.errors ?? 0}; commits=${t.commits ?? 0}; tool_calls=${t.tool_calls ?? 0}"`)
  return lines.join("\n") + "\n"
}

export function exportRollup(state, { period = 7 } = {}) {
  const hist = state.history || []
  const out = []
  out.push(`# Rollup — ${state.project || "unknown"} (last ${period} days)`)
  out.push("")
  const cutoff = Date.now() - period * 86400000
  const recent = hist.filter((h) => {
    const ts = Array.isArray(h) ? h[0] : h.t
    return typeof ts === "number" && ts >= cutoff
  })
  const totalPts = recent.reduce((s, h) => s + (Array.isArray(h) ? h[1] : h.p ?? 0), 0)
  out.push(`- Points earned: ${round(totalPts, 0)} (${recent.length} events)`)
  const t = state.totals || {}
  out.push(`- Verified: ${t.verified ?? 0} · Tests: ${t.tests ?? 0} · Deploys: ${t.deploys ?? 0} · Docs: ${t.docs ?? 0} · Commits: ${t.commits ?? 0}`)
  out.push(`- Overall: ${round(state.overall_pct ?? 0)}% · Growth: ${round(state.growth_rate_per_hour ?? 0)} pts/h · ETA: ${state.eta_minutes ? Math.round(state.eta_minutes) + " min" : "—"}`)
  const active = Object.entries(state.phases || {}).find(([, ph]) => ph.active)
  if (active) out.push(`- Active phase: ${active[0]}`)
  out.push("")
  return out.join("\n")
}

export function exportPrintHTML(state, { title } = {}) {
  const t = state.totals || {}
  const rows = PHASE_KEYS.map((key) => {
    const ph = (state.phases || {})[key]
    if (!ph) return ""
    const goal = ph.goal ?? DEFAULT_GOALS[key] ?? 1
    const pct = Math.min(100, round((ph.score / goal) * 100))
    return `<tr><td>${key}</td><td>${pct}%</td><td>${round(ph.score)} / ${goal}</td><td>${ph.events ?? 0}</td></tr>`
  }).join("")
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title || "Tracker export"}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:13px}th{background:#f4f4f5}.muted{color:#555;font-size:12px}</style></head>
<body><h1>${title || "Project Tracker export"} — ${state.project || ""}</h1>
<p class="muted">Overall: ${round(state.overall_pct ?? 0)}% · Verified: ${t.verified ?? 0} · Tests: ${t.tests ?? 0} · Deploys: ${t.deploys ?? 0} · Errors: ${t.errors ?? 0} · Tool calls: ${t.tool_calls ?? 0} · Growth: ${round(state.growth_rate_per_hour ?? 0)} pts/h</p>
<table><tr><th>Phase</th><th>%</th><th>Score / Goal</th><th>Events</th></tr>${rows}</table>
<p class="muted">Generated ${new Date().toISOString()} — ai-project-tracker PRO</p></body></html>`
}