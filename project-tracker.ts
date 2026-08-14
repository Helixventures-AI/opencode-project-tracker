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
 *    - وضعیت (state.json) + داشبورد گرافیکی (report.html) + گزارش متنی
 *      (report.md) به‌صورت زنده در <project>/.opencode/project-tracker/ تولید می‌شود
 *    - کامند `/tracker` (یا `/t`) خلاصهٔ عددی و درصدی را در چت نشان می‌دهد و
 *      داشبورد را در مرورگر باز می‌کند
 *
 *  امکانات نسخهٔ ۱.۱:
 *    - پیکربندی با config.json (اهداف، وزن‌ها، نام فازها) — پروژه‌ای یا سراسری
 *    - پیش‌بینی زمان اتمام (ETA) بر اساس نرخ رشد
 *    - نقطه‌های عطف (۲۵/۵۰/۷۵/۱۰۰٪) و نمودار روند با خط پیش‌بینی
 *    - لاگ آخرین فعالیت‌ها + گزارش Markdown + مقایسهٔ چند پروژه
 *
 *  امکانات نسخهٔ ۱.۲:
 *    - دکمهٔ تغییر زبان (فارسی / English) در داشبورد با ذخیرهٔ انتخاب کاربر
 *
 *  امکانات نسخهٔ ۱.۳:
 *    - فهرست فازهای کاملاً سفارشی (هر تعداد) با remap و default_phase
 *    - وضعیت خودکار هر عملیات (موفق/خطا/هشدار) + شرح از خروجی ابزار
 *    - ابزار tracker_note برای ثبت باگ‌ها، ارورها، موفقیت‌ها، پیشنهادها و راهکارها
 *    - بخش توصیه‌ها و راهکارها: تحلیل خودکار خطاها + پیشنهادهای ثبت‌شده
 *    - واردسازی خودکار پیشرفت موجود: جستجوی فایل‌های progress/roadmap
 *      (مثل USL_PROGRESS.md و reports/progress-*.json) در ریشهٔ پروژه و
 *      افزودن گام‌های انجام‌شده به امتیاز فازها — بدون نیاز به پیکربندی
 *
 *  امنیت: هیچ داده‌ای خارج از سیستم ارسال نمی‌شود؛ همه‌چیز محلی است.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { type Plugin, tool } from "@opencode-ai/plugin"
import { exec } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
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

const PHASE_DEFAULTS: PhaseDef[] = [
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

/* ── پیکربندی ──────────────────────────────────────────────────────────── */
interface TrackerConfig {
  goals: Record<string, number>
  weights: Record<string, number>
  names: Record<string, { en: string; fa: string }>
  phases?: Array<Partial<PhaseDef> & { key: string }>
  remap?: Record<string, string>
  default_phase?: string
  auto_seed?: boolean
}

const DEFAULT_CONFIG: TrackerConfig = { goals: {}, weights: {}, names: {} }

const PALETTE = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185", "#22d3ee", "#f97316", "#4ade80"]

function loadConfig(...files: string[]): TrackerConfig {
  const cfg: TrackerConfig = { goals: {}, weights: {}, names: {} }
  for (const f of files) {
    try {
      if (!fs.existsSync(f)) continue
      const raw = JSON.parse(fs.readFileSync(f, "utf8")) || {}
      if (raw.goals && typeof raw.goals === "object") for (const [k, v] of Object.entries(raw.goals)) if (typeof v === "number") cfg.goals[k] = v
      if (raw.weights && typeof raw.weights === "object") for (const [k, v] of Object.entries(raw.weights)) if (typeof v === "number") cfg.weights[k] = v
      if (raw.names && typeof raw.names === "object") for (const [k, v] of Object.entries(raw.names)) if (v && typeof v === "object" && typeof (v as any).en === "string") cfg.names[k] = { en: (v as any).en, fa: (v as any).fa }
      if (raw.remap && typeof raw.remap === "object") cfg.remap = { ...(cfg.remap || {}), ...raw.remap }
      if (typeof raw.default_phase === "string") cfg.default_phase = raw.default_phase
      if (Array.isArray(raw.phases)) {
        const valid = raw.phases.filter((p: any) => p && typeof p === "object" && typeof p.key === "string" && p.key)
        if (valid.length > 0) cfg.phases = valid
      }
      if (typeof raw.auto_seed === "boolean") cfg.auto_seed = raw.auto_seed
    } catch { /* bad config file → ignore */ }
  }
  return cfg
}

function effectivePhases(cfg: TrackerConfig): PhaseDef[] {
  if (cfg.phases && cfg.phases.length > 0) {
    return cfg.phases.map((p, i) => ({
      key: p.key,
      en: cfg.names[p.key]?.en ?? p.en ?? p.key,
      fa: cfg.names[p.key]?.fa ?? p.fa ?? p.key,
      desc_en: p.desc_en ?? "",
      desc_fa: p.desc_fa ?? "",
      goal: cfg.goals[p.key] ?? p.goal ?? 10,
      color: p.color ?? PALETTE[i % PALETTE.length],
    }))
  }
  return PHASE_DEFAULTS.map((p) => ({
    ...p,
    goal: cfg.goals[p.key] ?? p.goal,
    en: cfg.names[p.key]?.en ?? p.en,
    fa: cfg.names[p.key]?.fa ?? p.fa,
  }))
}

/* ── واردسازی خودکار پیشرفت موجود ───────────────────────────────────────── */
interface SeedItem { id: string; phase: string; score: number; status: string; detail: string }

const normKey = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\u200c]+/g, "")

const findPhase = (phases: PhaseDef[], v: string): string | null => {
  const n = normKey(v)
  if (!n) return null
  for (const p of phases) if (normKey(p.key) === n) return p.key
  for (const p of phases) if (normKey(p.en) === n || normKey(p.fa) === n) return p.key
  return null
}

function scanSeedFiles(root: string): string[] {
  const out: string[] = []
  const cands: string[] = []
  const push = (d: string, name: string) => { if (/progress|roadmap/i.test(name)) cands.push(path.join(d, name)) }
  try {
    for (const name of fs.readdirSync(root)) push(root, name)
    for (const sub of ["reports", "docs", "planning", "plans", "progress"]) {
      const d = path.join(root, sub)
      if (!fs.existsSync(d)) continue
      try {
        for (const name of fs.readdirSync(d)) push(d, name)
        if (sub === "reports") {
          for (const sub2 of fs.readdirSync(d)) {
            const d2 = path.join(d, sub2)
            try { if (fs.statSync(d2).isDirectory()) for (const name of fs.readdirSync(d2)) push(d2, name) } catch { /* noop */ }
          }
        }
      } catch { /* noop */ }
    }
  } catch { /* noop */ }
  for (const c of cands) {
    try { if (fs.statSync(c).isFile()) out.push(c) } catch { /* noop */ }
  }
  return out
}

function parseSeedFile(filePath: string, phases: PhaseDef[]): { items: SeedItem[]; skipped: number } {
  const items: SeedItem[] = []
  let skipped = 0
  const pushItem = (id: string, phase: string, score: number, status: string, detail: string) => {
    const canon = findPhase(phases, phase)
    if (!canon) { skipped += 1; return }
    items.push({ id, phase: canon, score, status, detail: String(detail || "").slice(0, 140) })
  }
  let raw = ""
  try { raw = fs.readFileSync(filePath, "utf8") } catch { return { items, skipped } }
  const isMd = /\.(md|markdown)$/i.test(filePath) || /^\s*[-*]\s*\[[ xX.oO]\]/m.test(raw) || /^#{1,3}\s/m.test(raw)
  if (isMd) {
    let cur = ""
    for (const line of raw.split("\n")) {
      const h = line.match(/^#{1,3}\s+(.*)$/)
      if (h) {
        const p = findPhase(phases, h[1].replace(/[#*`]+/g, "").trim())
        if (p) cur = p
        continue
      }
      const cl = line.match(/^\s*[-*]\s*\[([ xX.oO])\]\s*(.*)$/)
      if (!cl) continue
      let text = cl[2]
      const pm = text.match(/\(phase:\s*([^)]+)\)/i)
      if (pm) { const p = findPhase(phases, pm[1]); if (p) cur = p; text = text.replace(pm[0], "").trim() }
      if (!cur) continue
      const done = /[xXoO]/.test(cl[1])
      pushItem("md:" + cur + ":" + normKey(text), cur, done ? 1 : 0, done ? "done" : "todo", text)
    }
    return { items, skipped }
  }
  let data: any = null
  try { data = JSON.parse(raw) } catch { return items }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (Array.isArray(data.steps)) data = data.steps
    else if (data.phases && typeof data.phases === "object") {
      for (const [k, v] of Object.entries(data.phases)) pushItem("map:" + k, k, typeof v === "number" ? v : 1, "done", k)
      return { items, skipped }
    }
  }
  if (Array.isArray(data)) {
    data.forEach((it: any, i: number) => {
      if (!it || typeof it !== "object") return
      const phase = it.phase ?? it.fase ?? it.stage ?? it.category ?? it.area ?? it.key ?? ""
      const status = String(it.status ?? it.state ?? "").toLowerCase()
      const done = status === "" || /done|complete|committed|commited|ok|شده|کامل|✅|true/.test(status)
      const score = done ? (Number(it.score ?? it.points ?? it.weight ?? it.value) || 1) : 0
      const detail = String(it.name ?? it.title ?? it.task ?? phase)
      pushItem(it.id != null ? String(it.id) : "i" + i + ":" + normKey(detail), phase, score, done ? "done" : "todo", detail)
    })
  }
  return { items, skipped }
}

function addIssue(state: State, msg: string) {
  state.issues.push({ t: Date.now(), msg: String(msg).slice(0, 200) })
  if (state.issues.length > 20) state.issues.shift()
}

function seedState(state: State, phases: PhaseDef[], cfg: TrackerConfig, root: string): number {
  if (cfg.auto_seed === false) return 0
  let added = 0
  try {
    for (const filePath of scanSeedFiles(root)) {
      let mtime = 0
      try { mtime = fs.statSync(filePath).mtimeMs } catch { continue }
      const entry = state.seeded[filePath] || { ids: [], mtime: 0 }
      if (entry.mtime === mtime) continue
      const res = parseSeedFile(filePath, phases)
      if (!res.items.length) {
        addIssue(state, `⚠️ ورود داده رد شد: «${path.basename(filePath)}» — فرمت ناشناخته یا فاز ناآشنا (${res.skipped} گام)`)
        entry.mtime = mtime
        state.seeded[filePath] = entry
        continue
      }
      if (res.skipped > 0) addIssue(state, `⚠️ ${res.skipped} گام از «${path.basename(filePath)}» رد شد — فازشان با فازهای پروژه همخوانی ندارد`)
      const known = new Set(entry.ids)
      for (const it of res.items) {
        if (known.has(it.id)) continue
        known.add(it.id)
        const ph = state.phases[it.phase] || (state.phases[it.phase] = { score: 0, events: 0, active: false })
        ph.score += it.score
        ph.events += 1
        state.totals.seeded += 1
        if (it.status !== "todo") {
          state.log.unshift({ t: Date.now(), tool: "📥", phase: it.phase, weight: it.score, status: it.score > 0 ? "ok" : "warn", detail: it.detail })
          if (state.log.length > 100) state.log.pop()
        }
        added += 1
      }
      entry.ids = [...known]
      entry.mtime = mtime
      state.seeded[filePath] = entry
    }
    if (added > 0 && state.history.length <= 1 && (state.history[0]?.[1] || 0) === 0) {
      let score = 0, goal = 0
      for (const p of phases) { score += state.phases[p.key]?.score || 0; goal += p.goal }
      state.history = [[Date.now(), goal ? Math.round((score / goal) * 100) : 0]]
    }
  } catch { /* noop */ }
  return added
}

/* ── ساختار وضعیت ───────────────────────────────────────────────────────── */
interface PhaseState { score: number; events: number; active: boolean }
interface LogEvent { t: number; tool: string; phase: string; weight: number; status: string; detail: string; kind?: string; verified?: boolean }
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
    assistant_messages: number
    sessions: number
    errors: number
    successes: number
    suggestions: number
    seeded: number
    verified: number
  }
  seeded: Record<string, { ids: string[]; mtime: number }>
  issues: { t: number; msg: string }[]
  history: [number, number][]
  growth_rate_per_hour: number
  eta_minutes: number | null
  overall_pct: number
  milestones: number[]
  log: LogEvent[]
  chat_log: { t: number; text: string }[]
}

const emptyState = (project: string, keys: string[]): State => {
  const phases: Record<string, PhaseState> = {}
  for (const k of keys) phases[k] = { score: 0, events: 0, active: false }
  const now = Date.now()
  return {
    project,
    started_at: now,
    updated_at: now,
    phases,
    totals: {
      tool_calls: 0, edits: 0, writes: 0, bash: 0, tests: 0,
      deploys: 0, docs: 0, research: 0, commits: 0, messages: 0, sessions: 0,
      errors: 0, successes: 0, suggestions: 0, seeded: 0, verified: 0,
      assistant_messages: 0,
    },
    seeded: {},
    issues: [],
    history: [[now, 0]],
    growth_rate_per_hour: 0,
    eta_minutes: null,
    overall_pct: 0,
    milestones: [],
    log: [],
    chat_log: [],
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

/* ── محاسبهٔ نرخ رشد و ETA ─────────────────────────────────────────────── */
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

function computeEta(total: number, totalGoal: number, rate: number): number | null {
  if (rate <= 0 || total >= totalGoal) return null
  return Math.round(((totalGoal - total) / rate) * 60)
}

function relTime(ts: number, now: number): string {
  const s = Math.max(1, Math.round((now - ts) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"))

/* استخراج متن از content پیام (رشته یا آرایهٔ part های opencode) */
const msgText = (content: any): string => {
  if (!content) return ""
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join(" ")
  return String(content)
}

function describeTool(toolName: string, args: any, outText: string): { detail: string; status: string } {
  const txt = String(outText || "").trim()
  if (toolName === "bash") {
    const cmd = String(args?.command || "")
    const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean)
    const tail = lines.slice(-3).join(" | ")
    const detail = (tail || cmd).slice(0, 160)
    let status: string
    const tr = txt.match(/test result: (ok|FAILED)/i)
    if (tr) status = tr[1].toLowerCase() === "ok" ? "ok" : "error"
    else if (/failed|failure|panic|fatal|cannot|not found|exception|denied|refused|forbidden|invalid|✗|FAILED|\berror\b/i.test(txt + " " + cmd) && !/success|exited with code 0|passed|no errors?|errors?: 0|errors?: none/i.test(txt)) status = "error"
    else if (/success|exited with code 0|passed|✅|✓|ok\./i.test(txt)) status = "ok"
    else status = txt ? "ok" : "warn"
    return { detail, status }
  }
  if (toolName === "edit" || toolName === "write" || toolName === "read") {
    const f = String(args?.filePath || args?.path || toolName).split(/[\\/]/).pop()
    return { detail: f || toolName, status: "ok" }
  }
  return { detail: "", status: "ok" }
}

/* نتیجهٔ تأییدشدهٔ واقعی (تست سبز، بیلد موفق، دیپلوی) → امتیاز ویژه */
function detectOutcome(toolName: string, args: any, outText: string, status: string): { bonus: number; msg: string } | null {
  if (status !== "ok") return null
  const txt = String(outText || "")
  const cmd = String(args?.command || "")
  if (toolName === "bash") {
    const tr = txt.match(/test result: ok\.\s*(\d+)\s*passed/i)
    if (tr) return { bonus: 2, msg: `تست تأیید شد: ${tr[1]} پاس` }
    if (/test result: ok|tests? (all )?passed|passed/i.test(txt) && /test|cargo|pytest|npm test|go test|dotnet test/i.test(cmd)) return { bonus: 2, msg: "تست تأیید شد" }
    if (/docker push|compose up|kubectl apply|helm install|deployed/i.test(cmd) && !/error|fail/i.test(txt)) return { bonus: 2, msg: "استقرار تأیید شد" }
    if (/git (commit|push)|gh pr/i.test(cmd)) return { bonus: 1, msg: "کامیت/انتشار تأیید شد" }
    if (/Finished/i.test(txt) && /build|compile|make/i.test(cmd) && !/test/i.test(cmd)) return { bonus: 1, msg: "بیلد موفق" }
    if (/success|exited with code 0/i.test(txt) && /build|compile/i.test(cmd)) return { bonus: 1, msg: "بیلد موفق" }
  }
  return null
}

interface Insight { icon: string; fa: string; en: string; fixFa: string; fixEn: string }

function buildInsights(state: State, phases: PhaseDef[], nowMs: number = Date.now()): Insight[] {
  const ins: Insight[] = []
  const t = state.totals
  const errByPhase: Record<string, { count: number; last: string }> = {}
  for (const e of state.log) {
    if (e.status === "error") {
      const cur = errByPhase[e.phase] || { count: 0, last: "" }
      cur.count += 1
      if (!cur.last) cur.last = e.detail || ""
      errByPhase[e.phase] = cur
    }
  }
  for (const [phase, info] of Object.entries(errByPhase)) {
    const p = phases.find((x) => x.key === phase)
    const d = info.last.toLowerCase()
    let fixFa = "اجرای مجدد با خروجی کامل و بررسی لاگ"
    let fixEn = "Re-run with full output and inspect the logs"
    if (/test result: failed/i.test(d) || /fail/i.test(d)) { fixFa = "اجرای تستها با --nocapture و رفع اولین خطا؛ بررسی snapshot و متغیرهای محیط"; fixEn = "Run tests with --nocapture, fix the first failure; check snapshots and env vars" }
    else if (/not found/i.test(d)) { fixFa = "بررسی مسیر فایل، نام ایمپورت/پکیج و نصب وابستگی"; fixEn = "Check the file path, import/package name and installed dependencies" }
    else if (/denied|forbidden|permission/i.test(d)) { fixFa = "بررسی مجوزها، توکن‌ها و سطوح دسترسی"; fixEn = "Check permissions, tokens and access levels" }
    else if (/panic|unwrap/i.test(d)) { fixFa = "بررسی مقادیر null/None و مدیریت خطا به‌جای unwrap"; fixEn = "Check for null/None values; replace unwrap with match or ok_or" }
    else if (/port/i.test(d)) { fixFa = "بررسی اشغال پورت و تداخل سرویس‌ها"; fixEn = "Check port usage and service conflicts" }
    else if (/timeout|connect/i.test(d)) { fixFa = "بررسی اتصال شبکه، آدرس سرویس و مهلت اتصال"; fixEn = "Check the network, service address and connection timeouts" }
    ins.push({ icon: "❌", fa: `${info.count} خطا در فاز «${p?.fa || phase}» — آخرین: ${info.last.slice(0, 70)}`, en: `${info.count} errors in phase "${p?.en || phase}" — latest: ${info.last.slice(0, 70)}`, fixFa, fixEn })
  }
  const rate = t.tool_calls ? Math.round((t.errors / t.tool_calls) * 100) : 0
  if (t.errors > 0 && rate >= 20) ins.push({ icon: "⚠️", fa: `نرخ خطا ${rate}٪ از کل عملیات`, en: `Error rate ${rate}% of all operations`, fixFa: "توقف و بررسی ریشه‌ای: بازتولید خطا، لاگ کامل، تست واحد روی همان مسیر", fixEn: "Stop and investigate: reproduce the error, get full logs, add a unit test on that path" })
  const idleH = Math.floor((nowMs - (state.updated_at || nowMs)) / 3_600_000)
  if (t.tool_calls > 0 && idleH >= 2) ins.push({ icon: "⏸️", fa: `پروژه از ${idleH} ساعت پیش بدون فعالیت است`, en: `No activity for ${idleH} hours`, fixFa: "ادامهٔ کار روی فاز فعال و ثبت نتیجه", fixEn: "Resume work on the active phase and record the outcome" })
  if (t.verified > 0) ins.push({ icon: "⭐", fa: `${t.verified} گام تأییدشده (تست سبز / بیلد و استقرار موفق)`, en: `${t.verified} verified outcomes (green tests / successful build & deploy)`, fixFa: "هر نتیجهٔ واقعی را با تست/بیلد بعدی تأیید کنید", fixEn: "Keep verifying every real outcome with the next test/build" })
  if (t.tests === 0 && t.tool_calls >= 3) ins.push({ icon: "🧪", fa: "هنوز هیچ تستی اجرا نشده", en: "No test runs recorded yet", fixFa: "افزودن و اجرای تست برای فاز فعلی و ثبت نتیجه", fixEn: "Add and run tests for the current phase, then record the result" })
  if (t.commits === 0 && t.edits > 0) ins.push({ icon: "💾", fa: `ویرایش‌ها (${t.edits}) بدون کامیت`, en: `${t.edits} edits without any commit`, fixFa: "کامیت منظم با پیام توصیفی و push", fixEn: "Commit regularly with descriptive messages and push" })
  if (t.docs === 0) ins.push({ icon: "📚", fa: "مستندسازی انجام نشده", en: "No documentation ops yet", fixFa: "افزودن README/توضیح API و ثبت عملیات docs", fixEn: "Add README/API docs and record docs operations" })
  for (const p of phases) {
    const ph = state.phases[p.key]
    if (ph && ph.events === 0 && p.goal > 0) ins.push({ icon: "🚀", fa: `فاز «${p.fa}» هنوز شروع نشده`, en: `Phase "${p.en}" not started yet`, fixFa: "برنامه‌ریزی گام اول این فاز و شروع کار", fixEn: "Plan the first step of this phase and get started" })
  }
  if (t.errors === 0 && t.tool_calls >= 3) ins.push({ icon: "✅", fa: "بدون خطا تا اینجا — روند عالی", en: "No errors so far — great pace", fixFa: "ادامه با همین کیفیت؛ افزودن تست برای پوشش بیشتر", fixEn: "Keep the pace; add more tests for better coverage" })
  if (state.overall_pct >= 100) ins.push({ icon: "🎉", fa: "پروژه کامل شد", en: "Project completed", fixFa: "بستن فازها، بررسی نهایی و مستندسازی", fixEn: "Close out phases, final review and documentation" })
  for (const e of state.log) {
    if (e.kind === "suggestion" || e.kind === "solution" || e.kind === "recommendation") {
      ins.unshift({ icon: e.kind === "solution" ? "🔧" : "💡", fa: e.detail, en: e.detail, fixFa: "", fixEn: "" })
    }
  }
  return ins.slice(0, 6)
}

/* ── گزارش Markdown ────────────────────────────────────────────────────── */
function renderMd(state: State, phases: PhaseDef[], totalGoal: number, total: number): string {  const rows = phases.map((p) => {
    const ps = state.phases[p.key] || { score: 0, events: 0, active: false }
    const pct = clampPct((ps.score / p.goal) * 100)
    const st = pct >= 100 ? "✅" : ps.active ? "🟡" : "⚪"
    return `| ${p.en} / ${p.fa} | ${pct}% | ${ps.score}/${p.goal} | ${ps.events} | ${st} |`
  }).join("\n")
  const t = state.totals
  return `# 📊 Project Tracker — ${state.project}

- **پیشرفت کلی:** ${state.overall_pct}% (${total}/${totalGoal} امتیاز)
- **نرخ رشد:** ${state.growth_rate_per_hour} امتیاز/ساعت
- **پیش‌بینی اتمام:** ${state.eta_minutes != null ? Math.floor(state.eta_minutes / 60) + "h " + (state.eta_minutes % 60) + "m" : "—"}
- **به‌روزرسانی:** ${new Date(state.updated_at).toISOString()}

## فازها

| Phase | % | Score/Goal | Ops | Status |
|---|---|---|---|---|
${rows}

## آمار

- ابزار: ${t.tool_calls} · ویرایش: ${t.edits} · تست: ${t.tests} · استقرار: ${t.deploys} · مستندات: ${t.docs} · کامیت: ${t.commits} · چت: ${t.messages} · نشست: ${t.sessions}
- ✅ موفق: ${t.successes} · ❌ خطا: ${t.errors} · 💡 پیشنهاد: ${t.suggestions} · ⭐ تأییدشده: ${t.verified}${t.seeded > 0 ? ` · 📥 واردشده: ${t.seeded} گام (${Object.keys(state.seeded).map((p) => path.basename(p)).join("، ")})` : ""}

## خلاصهٔ کارهای اخیر (دستیار)

${state.chat_log.slice(0, 8).map((c) => `- 💬 ${c.text} — ${new Date(c.t).toLocaleString()}`).join("\n") || "- (هنوز پیامی ثبت نشده)"}

${state.issues.length > 0 ? `## ⚠️ اخطارها و موارد نادیده‌شده

${state.issues.slice(-5).map((i) => `- ${i.msg}`).join("\n")}` : ""}

## توصیه‌ها و راهکارها

${buildInsights(state, phases).map((r) => `- ${r.icon} ${r.fa}${r.fixFa ? `\n  - راهکار: ${r.fixFa}` : ""}`).join("\n") || "- (هیچ)"}

## آخرین فعالیت‌ها

${state.log.slice(0, 10).map((e) => {
    const st = e.status === "error" ? "❌" : e.status === "ok" ? "✅" : e.status === "warn" ? "⚠️" : "•"
    return `- ${st} \`${e.tool}\` → ${phases.find((p) => p.key === e.phase)?.en || e.phase} (+${e.weight}) — ${(e.detail || "").replace(/\|/g, "/")} — ${new Date(e.t).toLocaleString()}`
  }).join("\n") || "- (هیچ)"}
`
}

/* ── تولید فایل HTML داشبورد (دوزبانه) ─────────────────────────────────── */
function renderHtml(state: State, phases: PhaseDef[], dir: string, otherProjects: any[]): string {
  const totalGoal = phases.reduce((s, p) => s + p.goal, 0)
  const totalScore = phases.reduce((s, p) => s + (state.phases[p.key]?.score || 0), 0)
  const overall = state.overall_pct
  const minutes = Math.round((Date.now() - state.started_at) / 60000)
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  const duration = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`
  const eta = state.eta_minutes != null ? `${Math.floor(state.eta_minutes / 60)}h ${state.eta_minutes % 60}m` : "—"
  const nowMs = Date.now()

  const subEn = `Live update · ${duration} elapsed`
  const subFa = `به‌روزرسانی زنده · ${duration} زمان سپری‌شده`
  const dateEn = new Date(state.updated_at).toLocaleString("en-US")
  const dateFa = new Date(state.updated_at).toLocaleString("fa-IR")

  const seedFiles = Object.keys(state.seeded).map((p) => path.basename(p))
  const seedEn = seedFiles.join(", ")
  const seedFa = seedFiles.join("، ")
  const seedLineHtml = state.totals.seeded > 0
    ? `<div class="seed-line" data-en="📥 Imported: ${state.totals.seeded} steps from ${seedEn}" data-fa="📥 واردشده: ${state.totals.seeded} گام از ${seedFa}">📥 واردشده: ${state.totals.seeded} گام از ${seedFa}</div>`
    : ""
  const issuesHtml = state.issues.slice(-5).map((i) => `<div class="seed-line" style="color:#fbbf24">${esc(i.msg)}</div>`).join("")

  const faStatus: Record<string, string> = { done: "کامل", active: "فعال", idle: "در انتظار" }

  const recs = buildInsights(state, phases, nowMs)
  const recsHtml = recs.map((r) => `
    <div class="rec-row">
      <span class="rec-icon">${r.icon}</span>
      <div class="rec-body">
        <div class="rec-text" data-en="${esc(r.en)}" data-fa="${esc(r.fa)}">${esc(r.fa)}</div>
        ${r.fixFa ? `<div class="rec-fix" data-en="Fix: ${esc(r.fixEn)}" data-fa="راهکار: ${esc(r.fixFa)}">راهکار: ${esc(r.fixFa)}</div>` : ""}
      </div>
    </div>`).join("") || `<div class="muted" data-en="No recommendations yet" data-fa="هنوز توصیه‌ای ثبت نشده">هنوز توصیه‌ای ثبت نشده</div>`

  const phasesHtml = phases.map((p, i) => {
    const ps = state.phases[p.key] || { score: 0, events: 0, active: false }
    const pct = clampPct((ps.score / p.goal) * 100)
    const status = pct >= 100 ? "done" : ps.active ? "active" : "idle"
    const label = pct >= 100 ? "✓" : ps.active ? "●" : "○"
    const statusEn = `${label} ${status === "done" ? "Complete" : status === "active" ? "Active" : "Pending"}`
    const statusFa = `${label} ${faStatus[status]}`
    const metaEn = `${ps.score} / ${p.goal} pts · ${ps.events} ops`
    const metaFa = `${ps.score} از ${p.goal} امتیاز · ${ps.events} عملیات`
    return `
    <div class="phase-card" style="--acc:${p.color}">
      <div class="phase-head">
        <span class="step">${i + 1}</span>
        <div class="phase-title">
          <span class="ph-name" data-en="${p.en}" data-fa="${p.fa}">${p.fa}</span>
        </div>
        <span class="status-chip ${status}" data-en="${statusEn}" data-fa="${statusFa}">${statusFa}</span>
      </div>
      <div class="phase-desc" data-en="${p.desc_en}" data-fa="${p.desc_fa}">${p.desc_fa}</div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${p.color}"></div></div>
      <div class="phase-meta">
        <span class="pct">${pct}%</span>
        <span class="score" data-en="${metaEn}" data-fa="${metaFa}">${metaFa}</span>
      </div>
    </div>`
  }).join("")

  const hist = state.history
  const maxV = Math.max(...hist.map((p) => p[1]), totalGoal, 1)
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

  let projection = ""
  if (pts.length >= 2) {
    const seg = pts.slice(-60)
    const n = seg.length
    let mx = 0, my = 0
    for (const [x, y] of seg) { mx += x; my += y }
    mx /= n; my /= n
    let num = 0, den = 0
    for (const [x, y] of seg) { num += (x - mx) * (y - my); den += (x - mx) ** 2 }
    const slope = den > 0 ? num / den : 0
    if (slope > 0) {
      const [lx, ly] = seg[seg.length - 1]
      const yEnd = Math.min(H, ly + slope * (W - lx))
      projection = `<path class="proj-line" d="M${lx.toFixed(1)},${ly.toFixed(1)} L${W},${yEnd.toFixed(1)}"/>`
    }
  }

  const ringR = 62, ringC = 2 * Math.PI * ringR
  const ringDash = (overall / 100) * ringC

  const milestoneDefs = [
    { pct: 25, en: "Project started — planning & setup done, execution begins", fa: "شروع پروژه — برنامه‌ریزی و راه‌اندازی کامل شد، اجرا آغاز می‌شود" },
    { pct: 50, en: "Halfway — core implementation is in place", fa: "نیمهٔ راه — هستهٔ اصلی پیاده‌سازی شد" },
    { pct: 75, en: "Mostly done — stabilization, testing and polish phase", fa: "بخش اعظم — فاز تثبیت، تست و پالایش" },
    { pct: 100, en: "Complete — all phase goals reached", fa: "تکمیل — همهٔ اهداف فازها محقق شد" },
  ]

  const milestonesHtml = milestoneDefs.map((d) => {
    const reached = state.milestones.includes(d.pct)
    const color = d.pct >= 100 ? "#34d399" : d.pct >= 75 ? "#a78bfa" : d.pct >= 50 ? "#38bdf8" : "#fbbf24"
    const style = reached ? `style="--acc:${color}"` : ""
    return `<span class="ms-chip ${reached ? "" : "dim"}" ${style} title="${d.en} | ${d.fa}">🏆 ${d.pct}%</span>`
  }).join("")

  const milestonesLegend = milestoneDefs.map((d) =>
    `<span data-en="${d.pct}%: ${d.en}" data-fa="${d.pct}٪: ${d.fa}">${d.pct}٪: ${d.fa}</span>`
  ).join("<br>")

  const statusIcon: Record<string, string> = { ok: "✓", error: "✗", warn: "⚠", info: "•" }
  const statusColor: Record<string, string> = { ok: "#34d399", error: "#fb7185", warn: "#fbbf24", info: "#8b93b8" }

  const logHtml = state.log.slice(0, 8).map((e) => {
    const p = phases.find((x) => x.key === e.phase)
    const rel = relTime(e.t, nowMs)
    const st = e.status || "info"
    return `
    <div class="log-row">
      <span class="dot" style="background:${statusColor[st] || "#888"}"></span>
      <span class="log-status" style="color:${statusColor[st] || "#888"}">${statusIcon[st] || "•"}${e.verified ? "★" : ""}</span>
      <span class="log-tool">${e.tool}</span>
      <span class="log-phase" data-en="${p?.en || e.phase}" data-fa="${p?.fa || e.phase}">${p?.fa || e.phase}</span>
      <span class="log-detail" title="${esc(e.detail || "")}">${esc((e.detail || "").replace(/[\r\n\t]+/g, " ").slice(0, 80))}</span>
      <span class="log-w">+${e.weight}</span>
      <span class="log-t" data-en="${rel} ago" data-fa="${rel} قبل">${rel} قبل</span>
    </div>`
  }).join("") || `<div class="log-row muted" data-en="No activity recorded yet" data-fa="هنوز فعالیتی ثبت نشده">هنوز فعالیتی ثبت نشده</div>`

  const othersHtml = otherProjects.filter((o) => o.id !== state.project).slice(0, 5).map((o) =>
    `<div class="other-row"><span>${o.id}</span><div class="bar mini"><div class="bar-fill" style="width:${o.pct}%;background:#22d3ee"></div></div><b>${o.pct}%</b></div>`
  ).join("") || `<div class="log-row muted" data-en="Only this project is tracked" data-fa="فقط این پروژه پیگیری می‌شود">فقط این پروژه پیگیری می‌شود</div>`

  const t = state.totals
  const stats: [string, string, string, string][] = [
    ["Tool calls", "عملیات ابزار", String(t.tool_calls), "#22d3ee"],
    ["Edits", "ویرایش‌ها", String(t.edits), "#34d399"],
    ["Test runs", "اجرای تست", String(t.tests), "#fbbf24"],
    ["Deploy ops", "استقرار", String(t.deploys), "#a78bfa"],
    ["Docs ops", "مستندسازی", String(t.docs), "#f472b6"],
    ["Commits", "کامیت", String(t.commits), "#fb7185"],
    ["Messages", "پیام‌های چت", String(t.messages), "#818cf8"],
    ["Assistant messages", "پیام‌های دستیار", String(t.assistant_messages), "#22d3ee"],
    ["Sessions", "نشست‌ها", String(t.sessions), "#38bdf8"],
    ["Successes", "موفقیت‌ها", String(t.successes), "#34d399"],
    ["Errors", "خطاها", String(t.errors), "#fb7185"],
    ["Research", "پژوهش", String(t.research), "#f59e0b"],
    ["Suggestions", "پیشنهادها و راهکارها", String(t.suggestions), "#a3e635"],
    ["Imported", "گام‌های واردشده", String(t.seeded), "#22d3ee"],
    ["Verified", "گام‌های تأییدشده", String(t.verified), "#4ade80"],
  ]
  const statsHtml = stats.map(([en, fa, val, color]) => `
    <div class="stat" style="--acc:${color}">
      <span class="stat-val">${val}</span>
      <span class="stat-label" data-en="${en}" data-fa="${fa}">${fa}</span>
    </div>`).join("")

  const descLines = phases.map((p) =>
    `<div data-html-en="<b style=&quot;color:${p.color}&quot;>${p.en}</b>: ${p.desc_en}" data-html-fa="<b style=&quot;color:${p.color}&quot;>${p.fa}</b>: ${p.desc_fa}"><b style="color:${p.color}">${p.fa}</b>: ${p.desc_fa}</div>`
  ).join("")

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
  .proj-name{font-size:15px;font-weight:600;color:#7df3c8;margin-top:6px}
  .rep-date{color:var(--muted);font-size:12.5px;margin-top:3px}
  .seed-line{color:var(--muted);font-size:11.5px;margin-top:4px;opacity:.85}
  .pills{display:flex;gap:10px;flex-wrap:wrap}
  .pill{background:var(--glass);border:1px solid var(--stroke);border-radius:999px;padding:8px 16px;font-size:13px;display:flex;gap:8px;align-items:center}
  .pill b{color:#7df3c8}
  .pill .eta{color:#c4b5fd}
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
  .chart{margin-top:18px}
  .chart svg{width:100%;height:auto;border-radius:12px}
  .chart-grid{stroke:rgba(255,255,255,.05);stroke-width:1}
  .chart-area{fill:url(#areaGrad);stroke:none}
  .chart-line{fill:none;stroke:#22d3ee;stroke-width:2.5;stroke-linejoin:round}
  .proj-line{fill:none;stroke:#c084fc;stroke-width:2;stroke-dasharray:6 6}
  .ms-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  .ms-chip{font-size:11px;padding:4px 12px;border-radius:999px;border:1px solid var(--acc);color:var(--acc,#22d3ee);background:rgba(255,255,255,.04);cursor:help}
  .ms-chip.dim{opacity:.35;color:var(--muted);border-color:var(--stroke)}
  .ms-legend{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.9}
  body.lang-fa .ms-legend{direction:rtl;text-align:right}
  .ms-legend span{display:block}
  .phase-card{background:var(--glass);border:1px solid var(--stroke);border-radius:14px;padding:14px;margin-bottom:12px}
  .phase-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .step{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;background:var(--acc);color:#0b0f1f}
  .phase-title{flex:1;display:flex;flex-direction:column}
  .ph-name{font-size:14px;font-weight:600}
  .status-chip{font-size:11px;padding:3px 10px;border-radius:999px;border:1px solid var(--stroke)}
  .status-chip.done{color:#7df3c8;border-color:rgba(125,243,200,.35);background:rgba(125,243,200,.08)}
  .status-chip.active{color:#fde68a;border-color:rgba(253,230,138,.35);background:rgba(253,230,138,.08)}
  .status-chip.idle{color:var(--muted)}
  .phase-desc{font-size:12px;color:var(--muted);margin:8px 0 10px;line-height:1.7}
  body.lang-fa .phase-desc{direction:rtl;text-align:right}
  .bar{height:8px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
  .bar-fill{height:100%;border-radius:99px;transition:width .8s ease}
  .bar.mini{height:5px;flex:1;min-width:60px}
  .phase-meta{display:flex;justify-content:space-between;margin-top:7px;font-size:11.5px;color:var(--muted)}
  .phase-meta .pct{font-weight:700;color:var(--txt);font-size:13px}
  .log-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}
  .log-row:last-child{border-bottom:none}
  .log-row.muted{color:var(--muted)}
  .dot{width:8px;height:8px;border-radius:99px;flex:none}
  .log-tool{font-weight:600;min-width:90px}
  .log-status{font-weight:700;flex:none}
  .log-detail{color:var(--txt);font-size:11.5px;flex:2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .recs{display:flex;flex-direction:column;gap:8px}
  .rec-row{display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
  .rec-icon{font-size:15px;flex:none}
  .rec-body{display:flex;flex-direction:column;gap:3px;min-width:0}
  .rec-text{font-size:12.5px;font-weight:500;line-height:1.6}
  .rec-fix{font-size:11.5px;color:#a3e635;line-height:1.6}
  .log-phase{color:var(--muted);flex:1}
  .log-w{color:#7df3c8;font-weight:600}
  .log-t{color:var(--muted);font-size:11px;white-space:nowrap}
  .other-row{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:12px}
  .other-row b{color:#22d3ee;min-width:38px;text-align:left}
  .other-row span{min-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  footer{margin-top:20px;text-align:center;color:var(--muted);font-size:11.5px}
  body.lang-fa footer{direction:rtl}
  .btn{background:var(--grad);border:none;color:#0b0f1f;font-weight:700;padding:8px 18px;border-radius:999px;cursor:pointer;font-size:12.5px}
  .btn.ghost{background:transparent;border:1px solid var(--stroke);color:var(--txt);font-weight:500}
  .tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  .lang-btn{font-size:13px}
  @media print{
    body{background:#fff;color:#111;padding:10px}
    .card{background:#fff;backdrop-filter:none;border:1px solid #ddd;break-inside:avoid}
    h1{color:#111;background:none;-webkit-background-clip:unset}
    .proj-name{color:#0a7d52}
    .sub,.rep-date,.phase-desc,.phase-meta,.log-t,.log-phase,.ms-legend,footer{color:#555}    .stat-val{color:#0a7d52}
    .pct{color:#111}
    .bar{background:#e5e7eb}
    .status-chip{border-color:#ccc}
    .ms-chip.dim{opacity:.3}
    .chart svg{max-width:100%}
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1 data-en="📊 Project Tracker" data-fa="📊 ردیاب پروژه">📊 ردیاب پروژه</h1>
      <div class="proj-name">🗂️ ${state.project}</div>
      <div class="rep-date" data-en="📅 Report date: ${dateEn}" data-fa="📅 تاریخ گزارش: ${dateFa}">📅 تاریخ گزارش: ${dateFa}</div>
      ${seedLineHtml}
      ${issuesHtml}
      <div class="sub" data-en="${subEn}" data-fa="${subFa}">${subFa}</div>
    </div>
    <div class="pills">
      <button id="langBtn" class="btn ghost lang-btn" onclick="toggleLang()">English</button>
      <div class="pill">🌱 <span data-en="Growth: ${state.growth_rate_per_hour} pts/h" data-fa="رشد: ${state.growth_rate_per_hour} امتیاز/ساعت">رشد: ${state.growth_rate_per_hour} امتیاز/ساعت</span></div>
      <div class="pill">⏱️ <span class="eta" data-en="ETA: ${eta}" data-fa="پیش‌بینی اتمام: ${eta}">پیش‌بینی اتمام: ${eta}</span></div>
    </div>
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
            <div class="ring-txt"><b>${overall}%</b><span data-en="overall progress" data-fa="پیشرفت کلی">پیشرفت کلی</span></div>
          </div>
          <div class="gauge">
            <div data-html-en="<b>${totalScore}</b> points of ${totalGoal} phase goals" data-html-fa="<b>${totalScore}</b> امتیاز از ${totalGoal} هدف فازها"><b>${totalScore}</b> امتیاز از ${totalGoal} هدف فازها</div>
            <div data-en="${t.tool_calls} tool ops · ${t.tests} test runs" data-fa="${t.tool_calls} عملیات ابزار · ${t.tests} اجرای تست">${t.tool_calls} عملیات ابزار · ${t.tests} اجرای تست</div>
            <div data-en="${t.deploys} deploy ops · ${t.commits} commits" data-fa="${t.deploys} عملیات استقرار · ${t.commits} کامیت">${t.deploys} عملیات استقرار · ${t.commits} کامیت</div>
          </div>
        </div>
        <div class="ms-row">${milestonesHtml}</div>
        <div class="ms-legend">${milestonesLegend}</div>
        <div class="tools">
          <button class="btn" onclick="document.getElementById('desc').hidden=!document.getElementById('desc').hidden" data-en="Phase descriptions" data-fa="تشریح مراحل">تشریح مراحل</button>
          <button class="btn ghost" onclick="window.print()" data-en="Print / PDF" data-fa="چاپ / PDF">چاپ / PDF</button>
        </div>
        <div id="desc" hidden style="margin-top:12px;font-size:12px;color:var(--muted);line-height:2">
          ${descLines}
        </div>
      </div>

      <div class="card chart">
        <div style="font-size:13px;margin-bottom:6px" data-en="Score growth over time (— actual · — projected)" data-fa="رشد امتیاز در طول زمان (— روند واقعی · — پیش‌بینی)">رشد امتیاز در طول زمان (— روند واقعی · — پیش‌بینی)</div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          ${pts.length < 2 ? `
          <line class="chart-grid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke-dasharray="10 10"/>
          <text x="${W / 2}" y="${H / 2 - 12}" text-anchor="middle" fill="#8b93b8" font-size="14" data-en="⏳ Waiting for activity data — the chart will draw here as you work..." data-fa="⏳ در انتظار ثبت عملیات — با شروع کار، نمودار اینجا رسم می‌شود...">⏳ در انتظار ثبت عملیات — با شروع کار، نمودار اینجا رسم می‌شود...</text>` : `
          ${[0.25, 0.5, 0.75].map((f) => `<line class="chart-grid" x1="0" y1="${H * f}" x2="${W}" y2="${H * f}"/>`).join("")}
          <path class="chart-area" d="${area}"/>
          <polyline class="chart-line" points="${line}"/>
          ${projection}`}
        </svg>
      </div>

      <div class="card" style="margin-top:18px">
        <div style="font-size:13px;margin-bottom:8px" data-en="🕘 Recent activity" data-fa="🕘 آخرین فعالیت‌ها">🕘 آخرین فعالیت‌ها</div>
        ${logHtml}
      </div>

      <div class="card" style="margin-top:18px">
        <div style="font-size:13px;margin-bottom:8px" data-en="📋 Recent work summary (assistant)" data-fa="📋 خلاصهٔ کارهای اخیر (دستیار)">📋 خلاصهٔ کارهای اخیر (دستیار)</div>
        ${state.chat_log.slice(0, 8).map((c) => {
          const rel = relTime(c.t, nowMs)
          return `<div class="log-row"><span>💬</span><span class="log-detail" title="${esc(c.text)}">${esc(c.text)}</span><span class="log-t" data-en="${rel} ago" data-fa="${rel} قبل">${rel} قبل</span></div>`
        }).join("") || `<div class="log-row muted" data-en="No assistant messages yet" data-fa="هنوز پیامی از دستیار ثبت نشده">هنوز پیامی از دستیار ثبت نشده</div>`}
      </div>
    </div>

    <div>
      <div class="card" style="margin-bottom:18px">
        <div style="font-size:15px;font-weight:600;margin-bottom:14px" data-en="🧭 Project phases" data-fa="🧭 فازهای پروژه">🧭 فازهای پروژه</div>
        ${phasesHtml}
      </div>
      <div class="card" style="margin-top:18px">
        <div style="font-size:15px;font-weight:600;margin-bottom:14px" data-en="💡 Recommendations & Solutions" data-fa="💡 توصیه‌ها، پیشنهادات و راهکارها">💡 توصیه‌ها، پیشنهادات و راهکارها</div>
        <div class="recs">${recsHtml}</div>
      </div>
      <div class="stats">${statsHtml}</div>
      <div class="card" style="margin-top:18px">
        <div style="font-size:13px;margin-bottom:8px" data-en="🗂️ Other tracked projects" data-fa="🗂️ سایر پروژه‌های پیگیری‌شده">🗂️ سایر پروژه‌های پیگیری‌شده</div>
        ${othersHtml}
      </div>
    </div>
  </div>

  <footer data-en="opencode Project Tracker v1.4.0 — data stored locally in ${dir} · state.json · report.html · report.md" data-fa="opencode Project Tracker v1.4.0 — داده‌ها به‌صورت محلی در ${dir} ذخیره می‌شود · state.json · report.html · report.md">opencode Project Tracker v1.4.0 — داده‌ها به‌صورت محلی در ${dir} ذخیره می‌شود · state.json · report.html · report.md</footer>
</div>
<script>
var I18N = {
  title: { en: "📊 Project Tracker — ${state.project}", fa: "📊 ردیاب پروژه — ${state.project}" }
};
var lang = 'fa';
try { lang = localStorage.getItem('pt_lang') || 'fa'; } catch (e) { lang = 'fa'; }
function apply() {
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang === 'fa' ? 'fa' : 'en';
  document.body.className = 'lang-' + lang;
  var els = document.querySelectorAll('[data-en]');
  for (var i = 0; i < els.length; i++) { els[i].textContent = lang === 'fa' ? els[i].getAttribute('data-fa') : els[i].getAttribute('data-en'); }
  var htmlEls = document.querySelectorAll('[data-html-en]');
  for (var j = 0; j < htmlEls.length; j++) { htmlEls[j].innerHTML = lang === 'fa' ? htmlEls[j].getAttribute('data-html-fa') : htmlEls[j].getAttribute('data-html-en'); }
  document.getElementById('langBtn').textContent = lang === 'fa' ? 'English' : 'فارسی';
}
function toggleLang() {
  lang = lang === 'fa' ? 'en' : 'fa';
  try { localStorage.setItem('pt_lang', lang); } catch (e) {}
  apply();
}
apply();
</script>
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
  const mdFile = path.join(outDir, "report.md")
  const projectCfgFile = path.join(outDir, "config.json")
  const globalDir = process.env.PT_GLOBAL_DIR || path.join(os.homedir(), ".config", "opencode", "project-tracker")
  const globalCfgFile = path.join(globalDir, "config.json")
  const projectsFile = path.join(globalDir, "projects.json")

  let cfg: TrackerConfig = loadConfig(globalCfgFile, projectCfgFile)
  let phases: PhaseDef[] = effectivePhases(cfg)
  let state: State = emptyState(path.basename(root), phases.map((p) => p.key))
  let dirty = false
  let lastFlush = 0

  try {
    if (fs.existsSync(projectCfgFile)) JSON.parse(fs.readFileSync(projectCfgFile, "utf8"))
  } catch {
    addIssue(state, "⚠️ config.json ناخوانا است — بخشی از تنظیمات اعمال نشده")
  }

  const totalGoal = () => phases.reduce((s, p) => s + p.goal, 0)
  const totalScore = () => phases.reduce((s, p) => s + (state.phases[p.key]?.score || 0), 0)

  const load = () => {
    try {
      if (fs.existsSync(stateFile)) {
        const raw = JSON.parse(fs.readFileSync(stateFile, "utf8"))
        const keys = phases.map((p) => p.key)
        state = { ...emptyState(path.basename(root), keys), ...raw }
        state.phases = { ...emptyState(path.basename(root), keys).phases, ...(raw.phases || {}) }
        state.totals = { ...emptyState(path.basename(root), keys).totals, ...(raw.totals || {}) }
        if (!Array.isArray(state.history)) state.history = [[Date.now(), 0]]
        if (!Array.isArray(state.milestones)) state.milestones = []
        if (!Array.isArray(state.log)) state.log = []
        if (!state.seeded || typeof state.seeded !== "object") state.seeded = {}
        if (!Array.isArray(state.issues)) state.issues = []
        if (typeof state.totals.verified !== "number") state.totals.verified = 0
        if (typeof state.totals.assistant_messages !== "number") state.totals.assistant_messages = 0
        if (!Array.isArray(state.chat_log)) state.chat_log = []
      }
    } catch {
      try {
        const backup = `${stateFile}.corrupt-${Date.now()}`
        fs.renameSync(stateFile, backup)
        addIssue(state, `⚠️ state.json خراب بود — نسخهٔ پشتیبان «${path.basename(backup)}» ساخته شد و شمارش از نو آغاز شد`)
      } catch { /* noop */ }
    }
  }

  const updateGlobalProjects = () => {
    try {
      fs.mkdirSync(globalDir, { recursive: true })
      let list: any[] = []
      try { if (fs.existsSync(projectsFile)) list = JSON.parse(fs.readFileSync(projectsFile, "utf8")) || [] } catch { list = [] }
      if (!Array.isArray(list)) list = []
      const entry = { id: state.project, pct: state.overall_pct, updated_at: Date.now(), dir: root }
      const idx = list.findIndex((o) => o.id === state.project)
      if (idx >= 0) list[idx] = entry; else list.push(entry)
      list = list.filter((o) => o && typeof o === "object" && o.id).sort((a, b) => b.updated_at - a.updated_at).slice(0, 20)
      fs.writeFileSync(projectsFile, JSON.stringify(list, null, 2))
    } catch { /* noop */ }
  }

  const readOtherProjects = (): any[] => {
    try {
      if (!fs.existsSync(projectsFile)) return []
      const list = JSON.parse(fs.readFileSync(projectsFile, "utf8"))
      return Array.isArray(list) ? list : []
    } catch { return [] }
  }

  const writeNow = () => {
    try {
      cfg = loadConfig(globalCfgFile, projectCfgFile)
      phases = effectivePhases(cfg)
      for (const p of phases) if (!state.phases[p.key]) state.phases[p.key] = { score: 0, events: 0, active: false }
      state.growth_rate_per_hour = growthRate(state.history)
      state.overall_pct = clampPct((totalScore() / totalGoal()) * 100)
      state.eta_minutes = computeEta(totalScore(), totalGoal(), state.growth_rate_per_hour)
      checkMilestones()
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
      fs.writeFileSync(htmlFile, renderHtml(state, phases, outDir, readOtherProjects()))
      fs.writeFileSync(mdFile, renderMd(state, phases, totalGoal(), totalScore()))
      updateGlobalProjects()
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

  const checkMilestones = () => {
    const thresholds = [25, 50, 75, 100]
    const overall = state.overall_pct
    for (const t of thresholds) {
      if (overall >= t && !state.milestones.includes(t)) state.milestones.push(t)
    }
  }

  load()
  seedState(state, phases, cfg, root)
  writeNow()

  const timer = setInterval(() => flush(), 5000)
  timer.unref?.()

  return {
    "tool.execute.after": async (input: any, _output: any) => {
      try {
        const toolName = input?.tool
        if (toolName === "tracker_note") return
        const cls = classify(toolName, input?.args)
        let phase = cls.phase
        const mapped = cfg.remap?.[phase] || phase
        const phaseKeys = new Set(phases.map((p) => p.key))
        phase = phaseKeys.has(mapped) ? mapped : cfg.default_phase && phaseKeys.has(cfg.default_phase) ? cfg.default_phase : (phases[0]?.key || mapped)
        let weight = cls.weight
        if (typeof cfg.weights[toolName] === "number") weight = cfg.weights[toolName]
        const desc = describeTool(toolName, input?.args, _output?.output)
        const ph = state.phases[phase] || (state.phases[phase] = { score: 0, events: 0, active: false })

        ph.score += weight
        ph.events += 1
        for (const k of Object.keys(state.phases)) state.phases[k].active = k === phase

        const outcome = detectOutcome(toolName, input?.args, _output?.output, desc.status)
        let verified = false
        if (outcome) {
          ph.score += outcome.bonus
          state.totals.verified += 1
          verified = true
        }

        const totals = state.totals
        totals.tool_calls += 1
        if (toolName === "edit") totals.edits += 1
        if (toolName === "write") totals.writes += 1
        if (toolName === "bash") totals.bash += 1
        if (phase === "testing") totals.tests += 1
        if (phase === "deploy") totals.deploys += 1
        if (phase === "docs") totals.docs += 1
        if (phase === "research") totals.research += 1
        if (/\b(git commit|gh pr)\b/.test(String(input?.args?.command || ""))) totals.commits += 1
        if (desc.status === "error") totals.errors += 1
        if (desc.status === "ok") totals.successes += 1

        state.log.unshift({ t: Date.now(), tool: toolName || "?", phase, weight: weight + (outcome?.bonus || 0), status: desc.status, detail: desc.detail, verified })
        if (state.log.length > 100) state.log.pop()

        const total = totalScore()
        pushHistory(total)
        state.overall_pct = clampPct((total / totalGoal()) * 100)
        checkMilestones()
        state.updated_at = Date.now()
        dirty = true
        flush()
      } catch { /* noop */ }
    },

    "chat.message": async (_input: any, output: any) => {
      try {
        const role = output?.message?.role
        if (role === "user") {
          state.totals.messages += 1
          state.updated_at = Date.now()
          dirty = true
          flush()
        } else if (role === "assistant") {
          const text = msgText(output?.message?.content).replace(/[\r\n\t]+/g, " ").trim().slice(0, 160)
          if (text) {
            state.totals.assistant_messages += 1
            state.chat_log.unshift({ t: Date.now(), text })
            if (state.chat_log.length > 20) state.chat_log.pop()
            state.updated_at = Date.now()
            dirty = true
            flush()
          }
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
        if (String(input?.command || "") === "tracker") {
          seedState(state, phases, cfg, root)
          writeNow()
        }
      } catch { /* noop */ }
    },

    tool: {
      tracker_note: tool({
        description: "Record a short progress note into the project tracker: a bug found, an error, a successful operation, a decision, a suggestion or a solution for a problem. Call this whenever something noteworthy happens during the task.",
        args: {
          text: tool.schema.string().describe("Short note, max ~140 characters"),
          type: tool.schema.string().describe("One of: success, error, warning, info, suggestion, solution, recommendation").optional(),
        },
        async execute(args: any) {
          try {
            const type = String(args?.type || "info")
            const status = type === "success" ? "ok" : type === "error" ? "error" : type === "warning" ? "warn" : "info"
            const kind = ["suggestion", "solution", "recommendation"].includes(type) ? type : undefined
            const detail = String(args?.text || "").slice(0, 140)
            const activeKey = phases.find((p) => state.phases[p.key]?.active)?.key || phases[0]?.key || "coding"
            state.log.unshift({ t: Date.now(), tool: "📝", phase: activeKey, weight: 0.5, status, detail, kind })
            if (state.log.length > 100) state.log.pop()
            if (status === "error") state.totals.errors += 1
            if (status === "ok") state.totals.successes += 1
            if (status === "ok") state.totals.verified += 1
            if (kind) state.totals.suggestions += 1
            state.updated_at = Date.now()
            dirty = true
            flush()
            return "✅ Note recorded in the project tracker."
          } catch {
            return "Note recording failed."
          }
        },
      }),

      tracker_open: tool({
        description: "Open the project tracker dashboard (report.html) of any tracked project. Without args: the current project. With a project name or path fragment: that project's dashboard (resolved from the global project registry).",
        args: {
          project: tool.schema.string().describe("Optional: project name or path fragment of another tracked project").optional(),
        },
        async execute(args: any) {
          try {
            const all = readOtherProjects()
            let dir = root
            const q = String(args?.project || "").trim()
            if (q) {
              const lq = q.toLowerCase()
              const hit = all.find((o) => String(o.id).toLowerCase() === lq || String(o.id).toLowerCase().includes(lq) || String(o.dir || "").toLowerCase().includes(lq))
              if (!hit) return `پروژهٔ «${q}» یافت نشد. پروژه‌های ثبت‌شده: ${all.map((o) => o.id).join("، ") || "(هیچ)"}`
              dir = hit.dir
            }
            const html = path.join(dir, ".opencode", "project-tracker", "report.html")
            if (!fs.existsSync(html)) return `داشبوردی برای این پروژه پیدا نشد: ${html}`
            if (!process.env.PT_NO_OPEN) {
              const cmd = process.platform === "win32"
                ? `start "" "${html}"`
                : process.platform === "darwin" ? `open "${html}"` : `xdg-open "${html}"`
              exec(cmd, { cwd: dir }, () => { /* noop */ })
            }
            return `✅ داشبورد باز شد: ${html}`
          } catch {
            return "خطا در باز کردن داشبورد."
          }
        },
      }),
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
