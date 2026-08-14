/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  opencode Project Tracker Plugin — ردیاب زندهٔ مراحل و پیشرفت پروژه
 * ─────────────────────────────────────────────────────────────────────────────
 *  نصب (پس از نصب، opencode را ببندید و دوباره اجرا کنید):
 *    - پروژه‌ای:  .opencode/plugins/project-tracker.ts
 *    - سراسری:    ~/.config/opencode/plugins/project-tracker.ts
 *
 *  کارکرد:
 *    - هر عملیات ابزار (edit/write/bash/test/deploy/doc/...) به یکی از ۷ فاز
 *      پروژه نگاشت می‌شود و امتیاز می‌گیرد
 *    - وضعیت (state.json) + داشبورد گرافیکی (report.html) به‌صورت زنده در
 *      <project>/.opencode/project-tracker/  بازنویسی می‌شود
 *    - کامند `/tracker` خلاصهٔ عددی و درصدی را در چت نشان می‌دهد و داشبورد را
 *      در مرورگر باز می‌کند
 *
 *  امنیت: هیچ داده‌ای خارج از پروژه ارسال نمی‌شود؛ همه‌چیز محلی است.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Plugin } from "@opencode-ai/plugin"
import * as fs from "node:fs"
import * as path from "node:path"

/* جلوگیری از بارگذاری دوباره (اگر پلاگین هم در پوشهٔ سراسری و هم محلی باشد) */
const G = globalThis as any
const isPrimary = !G.__projectTrackerLoaded
G.__projectTrackerLoaded = true

/* ── فازهای استاندارد هر پروژه ─────────────────────────────────────────── */
interface PhaseDef {
  key: string
  en: string
  fa: string
  desc_en: string
  desc_fa: string
  goal: number
  color: string
}

const PHASES: PhaseDef[] = [
  {
    key: "research",
    en: "Research & Planning",
    fa: "پژوهش و برنامه‌ریزی",
    desc_en: "Requirements gathering, feasibility, architecture decisions, scope and roadmap.",
    desc_fa: "جمع‌آوری نیازمندی‌ها، امکان‌سنجی، تصمیم‌های معماری، دامنه و نقشهٔ راه.",
    goal: 15, color: "#38bdf8",
  },
  {
    key: "setup",
    en: "Architecture & Setup",
    fa: "معماری و راه‌اندازی",
    desc_en: "Project scaffolding, repo init, dependency configuration, CI skeleton.",
    desc_fa: "اسکلت پروژه، مقداردهی مخزن، تنظیم وابستگی‌ها، اسکلت CI.",
    goal: 15, color: "#818cf8",
  },
  {
    key: "coding",
    en: "Implementation",
    fa: "پیاده‌سازی کد",
    desc_en: "Feature implementation, refactoring, bug fixes, business logic.",
    desc_fa: "پیاده‌سازی امکانات، بازآرایی، رفع باگ، منطق کسب‌وکار.",
    goal: 60, color: "#34d399",
  },
  {
    key: "testing",
    en: "Testing & QA",
    fa: "تست و تضمین کیفیت",
    desc_en: "Unit, integration, E2E, load and security tests; verification runs.",
    desc_fa: "تست واحد، یکپارچه‌سازی، E2E، بار و امنیت؛ اجرای راستی‌آزمایی.",
    goal: 30, color: "#fbbf24",
  },
  {
    key: "docs",
    en: "Documentation",
    fa: "مستندسازی",
    desc_en: "README, guides, architecture docs, API references, changelog.",
    desc_fa: "راهنماها، مستندات معماری، مرجع API، تغییرات.",
    goal: 15, color: "#f472b6",
  },
  {
    key: "deploy",
    en: "Deployment & DevOps",
    fa: "استقرار و DevOps",
    desc_en: "Docker, Kubernetes, Terraform, CI/CD, infra provisioning, go-live.",
    desc_fa: "داکر، کوبرنتیز، ترفرم، CI/CD، زیرساخت و عرضهٔ نهایی.",
    goal: 20, color: "#a78bfa",
  },
  {
    key: "delivery",
    en: "Review & Delivery",
    fa: "بازبینی و تحویل",
    desc_en: "Code review, commits, PRs, release notes, handover.",
    desc_fa: "بازبینی کد، کامیت‌ها، PR، یادداشت انتشار و تحویل.",
    goal: 10, color: "#fb7185",
  },
]

/* ── ساختار وضعیت ───────────────────────────────────────────────────────── */
interface PhaseState { score: number; events: number; active: boolean }
interface State {
  project: string
  started_at: number
  updated_at: number
  phases: Record<string, PhaseState>
  totals: {
    tool_calls: number
    edits: number
    writes: number
    bash: number
    tests: number
    deploys: number
    docs: number
    research: number
    commits: number
    messages: number
    sessions: number
  }
  history: [number, number][]
  growth_rate_per_hour: number
}

const emptyState = (project: string): State => {
  const phases: Record<string, PhaseState> = {}
  for (const p of PHASES) phases[p.key] = { score: 0, events: 0, active: false }
  const now = Date.now()
  return {
    project,
    started_at: now,
    updated_at: now,
    phases,
    totals: {
      tool_calls: 0, edits: 0, writes: 0, bash: 0, tests: 0,
      deploys: 0, docs: 0, research: 0, commits: 0, messages: 0, sessions: 0,
    },
    history: [[now, 0]],
    growth_rate_per_hour: 0,
  }
}

/* ── ابزارهای کمکی ──────────────────────────────────────────────────────── */
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10))

function classify(toolName: string, args: any): { phase: string; weight: number } {
  const t = (toolName || "").toLowerCase()
  const cmd = String(args?.command || args?.cmd || "")
  const file = String(args?.filePath || args?.path || "")
  const isMd = /\.(md|markdown|txt|rst)$/i.test(file)

  if (t === "edit") return { phase: isMd ? "docs" : "coding", weight: 1.0 }
  if (t === "write") return { phase: isMd ? "docs" : "coding", weight: 1.2 }
  if (t === "read") return { phase: "research", weight: 0.3 }
  if (t === "glob" || t === "grep" || t === "list") return { phase: "research", weight: 0.2 }
  if (t === "webfetch" || t === "websearch") return { phase: "research", weight: 1.0 }
  if (t === "question") return { phase: "research", weight: 0.5 }
  if (t === "todowrite") return { phase: "research", weight: 0.5 }
  if (t === "task") return { phase: "coding", weight: 1.5 }

  if (t === "bash") {
    const c = cmd.toLowerCase()
    if (/\b(git commit|gh pr|git push|release)\b/.test(c)) return { phase: "delivery", weight: 2.0 }
    if (/\b(test|pytest|cargo test|cargo clippy|cargo fuzz|npm test|go test|dotnet test)\b/.test(c) || /psql.*select|smoke/.test(c))
      return { phase: "testing", weight: 2.0 }
    if (/\b(docker|kubectl|helm|terraform|compose|eksctl|awscdk|serverless|flyctl|vercel|netlify)\b/.test(c))
      return { phase: "deploy", weight: 2.5 }
    if (/\b(git init|git clone|cargo new|npm init|npx create|flutter create|scaffold|mkdir -p src)\b/.test(c))
      return { phase: "setup", weight: 1.5 }
    if (/\b(install|apt-get|pip install|npm install|yarn add|cargo add)\b/.test(c))
      return { phase: "setup", weight: 1.0 }
    return { phase: "coding", weight: 1.0 }
  }
  return { phase: "coding", weight: 0.5 }
}

/* ── محاسبهٔ نرخ رشد ───────────────────────────────────────────────────── */
function growthRate(h: [number, number][]): number {
  if (h.length < 2) return 0
  const now = h[h.length - 1][0]
  const cutoff = now - 60 * 60 * 1000
  const start = h.find((p) => p[0] >= cutoff) ?? h[0]
  const current = h[h.length - 1][1]
  const delta = current - start[1]
  const hours = Math.max((now - start[0]) / 3_600_000, 1 / 60)
  return Math.round((delta / Math.max(hours, 0.001)) * 10) / 10
}

/* ── تولید فایل HTML داشبورد ───────────────────────────────────────────── */
function renderHtml(state: State, dir: string): string {
  const totalGoal = PHASES.reduce((s, p) => s + p.goal, 0)
  const totalScore = PHASES.reduce((s, p) => s + (state.phases[p.key]?.score || 0), 0)
  const overall = clampPct((totalScore / totalGoal) * 100)
  const minutes = Math.round((Date.now() - state.started_at) / 60000)
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  const duration = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`

  const phasesHtml = PHASES.map((p, i) => {
    const ps = state.phases[p.key] || { score: 0, events: 0, active: false }
    const pct = clampPct((ps.score / p.goal) * 100)
    const done = pct >= 100
    const status = done ? "done" : ps.active ? "active" : "idle"
    const statusLabel = done ? "✓" : ps.active ? "●" : "○"
    const statusText = done ? "Complete" : ps.active ? "Active" : "Pending"
    return `
    <div class="phase-card" style="--acc:${p.color}">
      <div class="phase-head">
        <span class="step">${i + 1}</span>
        <div class="phase-title">
          <span class="ph-en">${p.en}</span>
          <span class="ph-fa">${p.fa}</span>
        </div>
        <span class="status-chip ${status}">${statusLabel} ${statusText}</span>
      </div>
      <div class="phase-desc">${p.desc_fa} — ${p.desc_en}</div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${p.color}"></div></div>
      <div class="phase-meta">
        <span class="pct">${pct}%</span>
        <span class="score">${ps.score} / ${p.goal} pts · ${ps.events} ops</span>
      </div>
    </div>`
  }).join("")

  const hist = state.history
  const maxV = Math.max(...hist.map((p) => p[1]), 1)
  const minT = hist[0][0]
  const maxT = Math.max(hist[hist.length - 1][0], minT + 1)
  const W = 900, H = 240
  const pts = hist.map(([t, v]) => {
    const x = ((t - minT) / (maxT - minT)) * W
    const y = H - (v / maxV) * (H - 20) - 10
    return [x, y] as const
  })
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = pts.length > 1 ? `M0,${H} L${line.split(" ").join(" L")} L${W},${H} Z` : ""
  const ringR = 62, ringC = 2 * Math.PI * ringR
  const ringDash = (overall / 100) * ringC

  const stat = (label: string, fa: string, val: string, color: string) => `
    <div class="stat" style="--acc:${color}">
      <span class="stat-val">${val}</span>
      <span class="stat-label">${label}</span>
      <span class="stat-fa">${fa}</span>
    </div>`

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Project Tracker — ${state.project}</title>
<style>
  :root{
    --bg1:#0b0f1f; --bg2:#151a35; --glass:rgba(255,255,255,.045);
    --stroke:rgba(255,255,255,.09); --txt:#e8ecff; --muted:#8b93b8;
    --grad:linear-gradient(135deg,#22d3ee,#818cf8,#c084fc);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:"Segoe UI",Tahoma,Arial,sans-serif;
    min-height:100vh;color:var(--txt);
    background:
      radial-gradient(1000px 500px at 85% -10%,rgba(129,140,248,.22),transparent 60%),
      radial-gradient(900px 500px at -10% 110%,rgba(34,211,238,.16),transparent 60%),
      linear-gradient(160deg,var(--bg1),var(--bg2));
    padding:28px 20px 60px;
  }
  .wrap{max-width:1060px;margin:0 auto}
  header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
  h1{font-size:22px;font-weight:700;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{color:var(--muted);font-size:12.5px;margin-top:4px}
  .pill{background:var(--glass);border:1px solid var(--stroke);border-radius:999px;padding:8px 16px;font-size:13px;display:flex;gap:10px;align-items:center}
  .pill b{color:#7df3c8}
  .grid{display:grid;grid-template-columns:340px 1fr;gap:18px}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}
  .card{background:var(--glass);border:1px solid var(--stroke);border-radius:18px;padding:20px;backdrop-filter:blur(10px)}
  .overall{display:flex;align-items:center;gap:20px}
  .ring-wrap{position:relative;width:150px;height:150px}
  .ring-wrap svg{transform:rotate(-90deg)}
  .ring-bg{fill:none;stroke:rgba(255,255,255,.08);stroke-width:12}
  .ring-fg{fill:none;stroke:url(#grad);stroke-width:12;stroke-linecap:round;stroke-dasharray:${ringC};stroke-dashoffset:${ringC - ringDash};transition:stroke-dashoffset 1s ease}
  .ring-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .ring-txt b{font-size:30px}
  .ring-txt span{color:var(--muted);font-size:12px}
  .gauge{font-size:13px;color:var(--muted);margin-top:14px;line-height:1.9}
  .gauge b{color:var(--txt)}
  .stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:16px}
  .stat{background:var(--glass);border:1px solid var(--stroke);border-radius:14px;padding:12px}
  .stat-val{font-size:19px;font-weight:700;color:var(--acc,#22d3ee)}
  .stat-label{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
  .stat-fa{display:block;font-size:11px;color:var(--muted);direction:rtl}
  .chart{margin-top:18px}
  .chart svg{width:100%;height:auto;border-radius:12px}
  .chart-grid{stroke:rgba(255,255,255,.05);stroke-width:1}
  .chart-area{fill:url(#areaGrad);stroke:none}
  .chart-line{fill:none;stroke:#22d3ee;stroke-width:2.5;stroke-linejoin:round}
  .phase-card{background:var(--glass);border:1px solid var(--stroke);border-radius:14px;padding:14px;margin-bottom:12px}
  .phase-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .step{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:var(--acc);color:#0b0f1f}
  .phase-title{flex:1;display:flex;flex-direction:column}
  .ph-en{font-size:14px;font-weight:600}
  .ph-fa{font-size:12px;color:var(--muted);direction:rtl}
  .status-chip{font-size:11px;padding:3px 10px;border-radius:999px;border:1px solid var(--stroke)}
  .status-chip.done{color:#7df3c8;border-color:rgba(125,243,200,.35);background:rgba(125,243,200,.08)}
  .status-chip.active{color:#fde68a;border-color:rgba(253,230,138,.35);background:rgba(253,230,138,.08)}
  .status-chip.idle{color:var(--muted)}
  .phase-desc{font-size:12px;color:var(--muted);margin:8px 0 10px;direction:rtl;text-align:right;line-height:1.7}
  .bar{height:8px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
  .bar-fill{height:100%;border-radius:99px;transition:width .8s ease}
  .phase-meta{display:flex;justify-content:space-between;margin-top:7px;font-size:11.5px;color:var(--muted)}
  .phase-meta .pct{font-weight:700;color:var(--txt);font-size:13px}
  footer{margin-top:20px;text-align:center;color:var(--muted);font-size:11.5px;direction:rtl}
  .btn{background:var(--grad);border:none;color:#0b0f1f;font-weight:700;padding:8px 18px;border-radius:999px;cursor:pointer;font-size:12.5px}
  .btn.ghost{background:transparent;border:1px solid var(--stroke);color:var(--txt);font-weight:500}
  .tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>📊 Project Tracker — ${state.project}</h1>
      <div class="sub">به‌روزرسانی زنده · ${new Date(state.updated_at).toLocaleString("fa-IR")} · ${duration} elapsed</div>
    </div>
    <div class="pill">رشد: <b>${state.growth_rate_per_hour} pts/h</b></div>
  </header>

  <div class="grid">
    <div>
      <div class="card">
        <div class="overall">
          <div class="ring-wrap">
            <svg width="150" height="150">
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#c084fc"/>
                </linearGradient>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#22d3ee" stop-opacity=".35"/>
                  <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <circle class="ring-bg" cx="75" cy="75" r="${ringR}"/>
              <circle class="ring-fg" cx="75" cy="75" r="${ringR}"/>
            </svg>
            <div class="ring-txt"><b>${overall}%</b><span>overall progress</span></div>
          </div>
          <div class="gauge">
            <b>${totalScore}</b> امتیاز از ${totalGoal} هدف فازها<br>
            ${state.totals.tool_calls} عملیات ابزار · ${state.totals.tests} اجرای تست<br>
            ${state.totals.deploys} عملیات استقرار · ${state.totals.commits} کامیت
          </div>
        </div>
        <div class="tools">
          <button class="btn" onclick="document.getElementById('desc').hidden=!document.getElementById('desc').hidden">تشریح مراحل</button>
          <button class="btn ghost" onclick="window.print()">چاپ / PDF</button>
        </div>
        <div id="desc" hidden style="margin-top:12px;font-size:12px;color:var(--muted);direction:rtl;line-height:2">
          ${PHASES.map((p) => `<b style="color:${p.color}">${p.fa}</b>: ${p.desc_fa}`).join("<br>")}
        </div>
      </div>

      <div class="card chart">
        <div style="font-size:13px;margin-bottom:6px">رشد امتیاز در طول زمان <span style="color:var(--muted)">(score over time)</span></div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          ${[0.25, 0.5, 0.75].map((f) => `<line class="chart-grid" x1="0" y1="${H * f}" x2="${W}" y2="${H * f}"/>`).join("")}
          <path class="chart-area" d="${area}"/>
          <polyline class="chart-line" points="${line}"/>
        </svg>
      </div>
    </div>

    <div>
      <div class="card" style="margin-bottom:18px">
        <div style="font-size:15px;font-weight:600;margin-bottom:14px">🧭 فازهای پروژه</div>
        ${phasesHtml}
      </div>
      <div class="stats">
        ${stat("Tool calls", "عملیات ابزار", String(state.totals.tool_calls), "#22d3ee")}
        ${stat("Edits", "ویرایش‌ها", String(state.totals.edits), "#34d399")}
        ${stat("Test runs", "اجرای تست", String(state.totals.tests), "#fbbf24")}
        ${stat("Deploy ops", "استقرار", String(state.totals.deploys), "#a78bfa")}
        ${stat("Docs ops", "مستندسازی", String(state.totals.docs), "#f472b6")}
        ${stat("Commits", "کامیت", String(state.totals.commits), "#fb7185")}
        ${stat("Messages", "پیام‌های چت", String(state.totals.messages), "#818cf8")}
        ${stat("Sessions", "نشست‌ها", String(state.totals.sessions), "#38bdf8")}
      </div>
    </div>
  </div>

  <footer>opencode Project Tracker — داده‌ها به‌صورت محلی در ${dir} ذخیره می‌شود و در هر عملیات به‌روزرسانی می‌شود</footer>
</div>
</body>
</html>`
}

/* ── پلاگین ────────────────────────────────────────────────────────────── */
const plugin: Plugin = async ({ project, directory, worktree }) => {
  if (!isPrimary) return {}
  const root = typeof project === "string"
    ? project
    : (project as any)?.path || (project as any)?.directory || (project as any)?.worktree || directory || worktree || process.cwd()
  const outDir = path.join(root, ".opencode", "project-tracker")
  const stateFile = path.join(outDir, "state.json")
  const htmlFile = path.join(outDir, "report.html")

  let state: State = emptyState(path.basename(root))
  let dirty = false
  let lastFlush = 0

  const load = () => {
    try {
      if (fs.existsSync(stateFile)) {
        const raw = JSON.parse(fs.readFileSync(stateFile, "utf8"))
        state = { ...emptyState(path.basename(root)), ...raw }
        state.phases = { ...emptyState(path.basename(root)).phases, ...(raw.phases || {}) }
        state.totals = { ...emptyState(path.basename(root)).totals, ...(raw.totals || {}) }
      }
    } catch { /* state file corrupt → start fresh */ }
  }

  const writeNow = () => {
    try {
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
      state.updated_at = Date.now()
      state.growth_rate_per_hour = growthRate(state.history)
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
      fs.writeFileSync(htmlFile, renderHtml(state, outDir))
      lastFlush = Date.now()
      dirty = false
    } catch { /* never crash opencode */ }
  }

  const flush = () => {
    if (dirty && Date.now() - lastFlush > 4000) writeNow()
  }

  const pushHistory = (total: number) => {
    const h = state.history
    const now = Date.now()
    if (h.length === 0 || now - h[h.length - 1][0] >= 60_000) {
      h.push([now, total])
      if (h.length > 300) h.shift()
    } else {
      h[h.length - 1][1] = total
    }
  }

  load()
  writeNow()

  const timer = setInterval(() => flush(), 5000)
  timer.unref?.()

  return {
    "tool.execute.after": async (input: any, _output: any) => {
      try {
        const { phase, weight } = classify(input?.tool, input?.args)
        const ph = state.phases[phase] || (state.phases[phase] = { score: 0, events: 0, active: false })

        ph.score += weight
        ph.events += 1
        for (const k of Object.keys(state.phases)) state.phases[k].active = k === phase

        const totals = state.totals
        totals.tool_calls += 1
        if (input?.tool === "edit") totals.edits += 1
        if (input?.tool === "write") totals.writes += 1
        if (input?.tool === "bash") totals.bash += 1
        if (phase === "testing") totals.tests += 1
        if (phase === "deploy") totals.deploys += 1
        if (phase === "docs") totals.docs += 1
        if (phase === "research") totals.research += 1
        if (/\b(git commit|gh pr)\b/.test(String(input?.args?.command || ""))) totals.commits += 1

        const total = PHASES.reduce((s, p) => s + (state.phases[p.key]?.score || 0), 0)
        pushHistory(total)
        dirty = true
        flush()
      } catch { /* noop */ }
    },

    "chat.message": async (_input: any, output: any) => {
      try {
        if (output?.message?.role === "user") {
          state.totals.messages += 1
          dirty = true
          flush()
        }
      } catch { /* noop */ }
    },

    event: async ({ event }: any) => {
      try {
        if (event?.type === "session.created") state.totals.sessions += 1
        if (event?.type === "session.idle") writeNow()
      } catch { /* noop */ }
    },

    "command.execute.before": async (input: any) => {
      try {
        if (String(input?.command || "") === "tracker") writeNow()
      } catch { /* noop */ }
    },

    dispose: async () => {
      try {
        clearInterval(timer)
        writeNow()
      } catch { /* noop */ }
    },
  }
}

export default plugin
