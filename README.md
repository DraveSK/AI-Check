# AI Check

**AI Check** is an AI-powered, privacy-first device inspection platform
that helps people understand, optimize, and protect their computers.

> **Status: Storage Analyzer MVP — real data on macOS, everything else
> still mock.** Running `npm run scan` on a Mac now writes a real
> `InspectionReport` that the Storage Analyzer, Overview storage cards, and
> Cleanup Recommendation screens read from. Security, Performance,
> Developer Environment, Crypto, AI Report, and History are still mock —
> see [ROADMAP.md](ROADMAP.md) for what's next and
> [docs/NEXT_COLLECTOR.md](docs/NEXT_COLLECTOR.md) for how to add one.

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
Performance, Developer Environment, Crypto, AI Report, History) is still
mock data — those collectors don't exist yet (see
[ROADMAP.md](ROADMAP.md)). Re-run `npm run scan` any time to refresh the
report; the dashboard picks it up on the next page load.

**macOS only for now.** Windows and Linux are placeholders — see
[docs/SCANNER_SPEC.md](docs/SCANNER_SPEC.md).

## Documentation

| Doc | Covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layered design, module map, extensibility |
| [SCHEMA.md](SCHEMA.md) | `InspectionReport` version/compatibility/deprecation/migration policy |
| [docs/API.md](docs/API.md) | REST contract between dashboard, scanner, and API |
| [docs/SCANNER_SPEC.md](docs/SCANNER_SPEC.md) | Per-platform scanner design (macOS/Windows/Linux) — design only, not yet implemented |
| [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md) | Collectors, signatures, rules, cleanup generation, AI explanation — kept intentionally simple |
| [docs/NEXT_COLLECTOR.md](docs/NEXT_COLLECTOR.md) | How to add the next real collector (Security, Performance, ...) following the Storage MVP's pattern |
| [PRIVACY.md](PRIVACY.md) | What AI Check can and cannot collect |
| [SECURITY.md](SECURITY.md) | Threat model, responsible disclosure, audit checklist |
| [docs/OPEN_CORE.md](docs/OPEN_CORE.md) | Open-source vs. closed-source split |
| [ROADMAP.md](ROADMAP.md) | Versioned milestones, v0.1 → v1.0 |
| [CHANGELOG.md](CHANGELOG.md) | What shipped, release by release |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, where to contribute, PR conventions |

## Project structure

```
src/
  pages/         screens — render only, no domain logic
  components/     shared UI primitives + ProviderGate
  providers/      provider interfaces + mock implementation
  types/          shared domain types (the schema every layer agrees on)
  hooks/          useProviderData and friends
  utils/          pure helpers (formatBytes, ...)
  config/         navigation, environment-driven switches
functions/api/    Cloudflare Pages Functions (API boundary)
scanner/          Storage collector (macOS), signatures, rules, report assembly, CLI
docs/             API, scanner, and open-core specs
```

There is no separate plugin/SDK/rules/signatures scaffolding — the scanner
is plain functions and data structures in one codebase (see
`scanner/` and [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md)) until
there's a concrete reason to split it out further.

## License

MIT — see [LICENSE](LICENSE). See [docs/OPEN_CORE.md](docs/OPEN_CORE.md)
for what stays open source vs. what may live in a separate closed-source
counterpart (hosted AI analysis, team features, billing).
