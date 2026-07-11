# AI Check

**AI Check** is an AI-powered, privacy-first device inspection platform
that helps people understand, optimize, and protect their computers.

> **Status: production SaaS foundation — real storage scanning on macOS,
> real hosted backend on Cloudflare.** The full journey works end-to-end:
> sign in with a magic link, run a local scan, upload the report
> (explicit opt-in), view it in the hosted dashboard, request AI analysis
> with your own API key, and export the results. Security, Performance,
> Developer Environment, and Crypto collectors are specified but not yet
> implemented — those screens still show mock data. See
> [ROADMAP.md](ROADMAP.md) and [docs/NEXT_COLLECTOR.md](docs/NEXT_COLLECTOR.md).

## Principles

- **Privacy First** — see [PRIVACY.md](PRIVACY.md) for the exact allow-list
  of what AI Check may ever collect (metadata only — never file contents,
  passwords, keys, or wallet seeds)
- **Open Source First** — the dashboard, local scanner, and report schema
  are MIT-licensed; see [docs/OPEN_CORE.md](docs/OPEN_CORE.md)
- **Security by Design** — see [SECURITY.md](SECURITY.md) for the threat
  model and disclosure process
- **AI Agnostic** — bring your own AI API key; no vendor lock-in
- **Cloud Native** — built for Cloudflare Pages/Workers, but the API
  contract (`docs/API.md`) is host-agnostic
- **Modular Architecture** — every layer (dashboard, providers, API,
  scanner, AI engine) is independently replaceable; see
  [ARCHITECTURE.md](ARCHITECTURE.md)
- **Cross Platform** — macOS, Windows, and Linux are first-class targets
  (see [docs/SCANNER_SPEC.md](docs/SCANNER_SPEC.md))
- **Future Enterprise Ready** — the provider-interface pattern is the seam
  team/enterprise features plug into without forking the open-source core

## Architecture at a glance

```
Dashboard → Provider Layer → API → Scanner → AI Engine → Reports
```

Full diagram and explanation in [ARCHITECTURE.md](ARCHITECTURE.md).

The load-bearing rule: **no screen hardcodes a domain value.** Every number
and status on every screen comes from a provider interface
(`src/providers/types.ts`), currently backed by a mock implementation
(`src/providers/mock`). Swapping in a real scanner or cloud API later is a
one-file change, not a UI rewrite.

## Run locally

```bash
npm install
npm run dev       # Vite dev server at http://localhost:5173, mock data
npm run build     # tsc -b && vite build
npm run preview   # preview the production build
```

No backend, database, or native toolchain required — the dashboard runs
entirely against `src/providers/mock` out of the box.

## Scan your own Mac (Storage Analyzer MVP)

```bash
npm run scan
```

This walks your home folder (metadata only — see [PRIVACY.md](PRIVACY.md)),
measures known developer-tool and cache locations, and writes
`public/ai-check-report.json`. It also prints a plain-text summary to the
terminal: largest folders, what's safe to clean, and the exact shell
command for each (nothing is ever run for you — see
[docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md) §Cleanup script
generation).

To see the result in the dashboard instead of mock data, set the provider
mode before starting the dev server:

```bash
echo "VITE_PROVIDER_MODE=local-report" > .env.local
npm run dev
```

Storage Analyzer, the Overview storage/cleanup cards, and Cleanup
Recommendation now show your real disk. Everything else (Security,
Performance, Developer Environment, Crypto, AI Report) is still mock
data — those collectors don't exist yet (see [ROADMAP.md](ROADMAP.md)).

**macOS only for now.** Windows and Linux are placeholders — see
[docs/SCANNER_SPEC.md](docs/SCANNER_SPEC.md).

## Use the hosted SaaS (cloud mode)

Against a deployed instance (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)):

```bash
# 1. Sign in — a magic link is emailed to you (no password exists anywhere)
npm run login -- you@example.com

# 2. Scan and upload — upload happens ONLY with this explicit flag
npm run scan -- --upload
```

The hosted dashboard (built with `VITE_PROVIDER_MODE=cloud-api`) shows a
sign-in screen, then your uploaded reports: storage breakdown, cleanup
recommendations, scan history with comparisons, and — after you add your
own AI provider key in Settings (`POST /api/v1/providers`, encrypted at
rest) — AI-written analysis. Full API reference: [docs/API.md](docs/API.md).

Provider modes at a glance:

| `VITE_PROVIDER_MODE` | Data source | Needs |
|---|---|---|
| `mock` (default) | Fixtures | Nothing — instant demo |
| `local-report` | `npm run scan` output on this machine | No account, no network |
| `cloud-api` | The hosted Worker API | Deployed backend + sign-in |

## See what changed since your last scan

Every `npm run scan` saves a snapshot to local history
(`.ai-check-history/`, never uploaded — see
[docs/HISTORY_FORMAT.md](docs/HISTORY_FORMAT.md)) and prints what changed
since the previous one:

```
Since last scan (2026-07-11T09:15:35.488Z):
  Disk usage: -0.1 GB
  Biggest cleanup: Downloads -0.1 GB
  Recovered: 0.1 GB
  - Downloads shrank by 0.1 GB. No action required.
```

Run it a few times over a few days and:

- **Overview** gets a "Storage changes" card (biggest growth/cleanup,
  total difference, recovered space, time since last scan)
- **Scan History** (left nav) shows every scan, cleanup statistics
  (total recovered, largest cleanup ever, trend), and a before/after
  comparison between any two scans you pick, color-coded green
  (recovered) / red (growth) / gray (no change)
- Any report, comparison, or the full history can be exported as JSON,
  Markdown, or HTML — all generated in your browser, nothing leaves your
  machine

The very first scan has nothing to compare against — the dashboard says
so plainly rather than showing an error. From the second scan onward,
comparison works automatically.

## Documentation

| Doc | Covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layered design, module map, extensibility |
| [SCHEMA.md](SCHEMA.md) | `InspectionReport` version/compatibility/deprecation/migration policy |
| [docs/API.md](docs/API.md) | REST API reference — auth, reports, AI analysis, BYO keys, export |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Cloudflare setup: D1/R2/KV provisioning, secrets, CI/CD, rollback |
| [docs/SCANNER_SPEC.md](docs/SCANNER_SPEC.md) | Per-platform scanner design (macOS/Windows/Linux) — design only, not yet implemented |
| [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md) | Collectors, signatures, rules, cleanup generation, AI explanation — kept intentionally simple |
| [docs/NEXT_COLLECTOR.md](docs/NEXT_COLLECTOR.md) | How to add the next real collector (Security, Performance, ...) following the Storage MVP's pattern |
| [docs/HISTORY_FORMAT.md](docs/HISTORY_FORMAT.md) | Local scan history format, comparison shape, retention, export |
| [PRIVACY.md](PRIVACY.md) | What AI Check can and cannot collect |
| [SECURITY.md](SECURITY.md) | Threat model, responsible disclosure, audit checklist |
| [docs/OPEN_CORE.md](docs/OPEN_CORE.md) | Open-source vs. closed-source split |
| [ROADMAP.md](ROADMAP.md) | Versioned milestones, v0.1 → v1.0 |
| [CHANGELOG.md](CHANGELOG.md) | What shipped, release by release |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, where to contribute, PR conventions |

## Project structure

```
src/
  pages/         screens — render only, no domain logic (+ Login for cloud mode)
  components/     shared UI primitives + ProviderGate
  providers/      provider interfaces + mock / local-report / cloud-api registries
  types/          shared domain types (the schema every layer agrees on)
  hooks/          useProviderData, useCloudAuth
  utils/          pure helpers (formatBytes, compareReports, export formatters)
  config/         navigation, environment-driven switches
worker/           Cloudflare Worker: /api/v1 routes, auth, AI layer, D1/R2 helpers
d1/migrations/    D1 (SQLite) schema migrations
scanner/          Storage collector (macOS), signatures, rules, history, login/upload, CLI
docs/             API, deployment, scanner, history, and open-core specs
.ai-check-history/  local scan history (gitignored — created by `npm run scan`)
```

There is no separate plugin/SDK/rules/signatures scaffolding — the scanner
is plain functions and data structures in one codebase (see
`scanner/` and [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md)) until
there's a concrete reason to split it out further.

## License

MIT — see [LICENSE](LICENSE). See [docs/OPEN_CORE.md](docs/OPEN_CORE.md)
for what stays open source vs. what may live in a separate closed-source
counterpart (hosted AI analysis, team features, billing).
