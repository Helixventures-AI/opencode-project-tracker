/**
 * ai-project-tracker PRO — brand.mjs
 * Injects custom branding (colors, logo, name) into a generated report.html.
 *
 * theme.json:
 * {
 *   "name": "Acme DevKit",
 *   "logo": "🏗️",              // emoji or text (optional)
 *   "logo_url": "https://...", // optional image URL (overrides logo)
 *   "colors": {
 *     "accent": "#f59e0b",
 *     "bg1": "#0c0a09",
 *     "bg2": "#1c1917",
 *     "grad": "linear-gradient(135deg,#f59e0b,#ef4444)"
 *   },
 *   "tagline": "Engineering Dashboard"   // optional subtitle
 * }
 */

export function applyBrand(html, theme) {
  if (!theme || typeof theme !== "object") return html
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  const c = theme.colors || {}

  const overrides = []
  if (c.accent) overrides.push(`--acc:${c.accent};`)
  if (c.bg1) overrides.push(`--bg1:${c.bg1};`)
  if (c.bg2) overrides.push(`--bg2:${c.bg2};`)
  if (c.grad) overrides.push(`--grad:${c.grad};`)

  const style = overrides.length
    ? `<style id="pro-brand">:root{${overrides.join("")}}</style>`
    : ""

  let out = html
  if (theme.name) {
    out = out.replace(/<title>.*?<\/title>/s, `<title>${esc(theme.name)} — ${esc(theme.tagline || "Project Tracker")}</title>`)
    out = out.replace(/(<h1[^>]*>).*?(<\/h1>)/s, `$1${esc(theme.logo || "")} ${esc(theme.name)}$2`)
    if (theme.logo_url) {
      out = out.replace(/(<h1[^>]*>)/, `$1<img src="${esc(theme.logo_url)}" alt="logo" style="height:1em;vertical-align:-0.12em;margin-right:6px">`)
    }
    if (theme.tagline) {
      out = out.replace(/(<div class="sub"[^>]*>).*?(<\/div>)/s, `$1${esc(theme.tagline)}$2`)
    }
  }
  if (style) {
    out = out.replace(/<\/head>/i, `${style}\n</head>`)
  }
  return out
}