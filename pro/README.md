# ai-project-tracker PRO

Paid edition of [ai-project-tracker](https://github.com/Helixventures-AI/ai-project-tracker). The MIT core stays free; PRO adds team dashboards, branding, advanced exports and offline licensing.

## Features

| Feature | Command |
|---|---|
| **Team dashboard** — one page with every tracked project (%, growth, ETA, milestones, activity) | `node pro/pro.mjs team [out.html]` |
| **Branding** — custom colors, logo, name injected into `report.html` | `node pro/pro.mjs brand theme.json [report.html]` |
| **Advanced export** — CSV stats, weekly rollup, print-ready HTML (→ PDF via browser) | `node pro/pro.mjs export <project-dir> --csv\|--print\|--rollup [out]` |
| **License status** | `node pro/pro.mjs status` |

All features are **offline** — no servers, no telemetry. The license key is Ed25519-signed and verified locally.

## License key

```
set AIPT_PRO_KEY=<key>        # or
echo <key> > ~/.config/ai-project-tracker/pro.license
```

See `../docs/PRO.md` for the full plan (features, roadmap, pricing model).

## For sellers (this repo only, never shipped)

- `node pro/keygen.mjs keypair` — regenerate signing keys (writes `pro/.license-secret.key`, gitignored; keep it secret, back it up)
- `node pro/keygen.mjs gen <email> <tier> <days>` — issue a license key
- `node pro/keygen.mjs verify <key> [email]` — verify a key

The public key is embedded in `pro/license.mjs`; the private key never ships.