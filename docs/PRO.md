# Pro Edition — Plan / نسخهٔ پرو — طرح

> Bilingual plan for the paid **Pro** edition. The MIT core stays free; Pro adds team/branding/export/cloud features and is sold under a commercial license. / پلن دوزبانه برای نسخهٔ پولی **پرو**. هستهٔ MIT رایگان میماند؛ پرو ویژگیهای تیم/برندینگ/خروجی/ابر را اضافه میکند و تحت مجوز تجاری فروخته میشود.

## Model / مدل

| Tier / سطح | License / مجوز | Price / قیمت (پیشنهادی) |
|---|---|---|
| Core (this repo) | MIT | free / رایگان |
| **Pro** | commercial (paid) / تجاری | one-time ~$49 or $9/mo |
| **Team** | commercial per-seat / تجاری پرسنلی | $99–299/seat/year |

## Features / ویژگیها

### ✅ Pro (local-first — this repo can build it now / قابل ساخت همین حالا، بدون بکاند)

1. **Team dashboard / داشبورد تیمی** — aggregate all tracked projects (from the global registry + each `state.json`) into one `team.html`: per-member phases, % , growth, ETA. No server needed. / تجمیع همهٔ پروژههای ردیابیشده در یک صفحه.
2. **Branding / برندینگ** — custom colors, logo, product/company name injected into the dashboard via a `theme.json`. / رنگ، لوگو و نام سفارشی در داشبورد.
3. **Advanced export / خروجی پیشرفته** — CSV (stats), print-friendly HTML (→ PDF via browser), weekly/monthly rollup reports. / خروجی CSV و HTML چاپی و گزارش دورهای.
4. **Offline license key / کلید مجوز آفلاین** — HMAC-signed keys gate Pro features; no phone-home. / کلید امضاشده؛ بدون اتصال به اینترنت.

### 🔜 Phase 2 — needs a backend / نیازمند بکاند

5. **Cloud sync / سینک ابری** — optional encrypted sync of `state.json` for remote collaboration. / همگامسازی اختیاری و رمزنگاریشده.
6. **Team accounts & SSO / حساب تیمی** — roles, permissions, single sign-on. / نقشها و مجوزها.
7. **Trends & analytics / روند و تحلیل** — cross-project velocity, burn-down, forecasting. / سرعت میانپروژهای و پیشبینی.

## Roadmap / نقشهٔ راه

| Milestone | Deliverable / خروجی |
|---|---|
| **P1** (now) | `pro/` scaffold: license, brand, export (CSV/HTML), team dashboard + `docs/PRO.md`, bilingual |
| **P2** | `pro/` CLI: `pt pro team`, `pt pro export`, `pt pro brand`; tests + publish as a **separate npm package** (`ai-project-tracker-pro`) |
| **P3** | Gumroad/LemonSqueezy listing, license-key issuing, pricing page |
| **P4** | Backend: cloud sync + team accounts (optional) |

## Repository layout / چیدمان

```
pro/
├── license.mjs   # offline HMAC license check
├── brand.mjs     # theme.json → dashboard branding
├── export.mjs    # CSV + print HTML + rollup reports
├── team.mjs      # aggregate projects → team.html
└── README.md
docs/PRO.md       # this plan (bilingual)
```

## Notes / نکات

- MIT core and Pro stay **separately packaged** so the free path stays clean. / هسته و پرو جدا بستهبندی میشوند.
- License keys are **per-install** (not per-feature); branding/team/export unlocked together. / کلید بهازای نصب، همهٔ ویژگیهای Pro را باز میکند.