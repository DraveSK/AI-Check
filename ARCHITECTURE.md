# Architecture

## Layered flow

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard (src/pages/*)                                     │
│  React screens — render only, zero domain logic, zero        │
│  hardcoded numbers. Consume data exclusively via hooks.       │
└───────────────────────────┬────────────────────────────────┘
                             │ useProviders() / useProviderData()
┌───────────────────────────▼────────────────────────────────┐
│  Provider Layer (src/providers/*)                             │
│  Interfaces: HealthProvider, StorageProvider,                 │
│  SecurityProvider, PerformanceProvider,                       │
│  DeveloperEnvironmentProvider, CryptoProvider,                │
│  CleanupProvider, AIReportProvider, HistoryProvider,           │
│  DeviceProvider. Each returns a ProviderResult<T> envelope     │
│  (loading/empty/error/ready) — see src/types/index.ts.        │
│  Three registries, selected by VITE_PROVIDER_MODE with no      │
│  change to any screen: `mock` (fixtures), `local-report`       │
│  (reads the JSON npm run scan writes), `cloud-api` (the        │
│  hosted API below, gated by magic-link sign-in).               │
└───────────────────────────┬────────────────────────────────┘
                             │ HTTPS (cloud-api provider only)
┌───────────────────────────▼────────────────────────────────┐
│  API (worker/index.ts + worker/routes/*)                      │
│  One Cloudflare Worker: serves the built dashboard (ASSETS)   │
│  and /api/v1/* in the same process. Zod-validates every       │
│  request, stores reports (R2) + summaries (D1), brokers       │
│  BYO-key AI analysis, rate-limits via KV. See docs/API.md.    │
└───────────┬─────────────────────────────────┬───────────────┘
            │ POST /api/v1/report                │ POST /api/v1/analyze
┌───────────▼───────────────┐      ┌───────────▼───────────────┐
│  Scanner (scanner/*)       │      │  AI Layer (worker/lib/ai)  │
│  Local, read-mostly CLI    │      │  One AIProvider interface,  │
│  (macOS Storage today).    │      │  six vendors (Anthropic,    │
│  Local-first: uploads only │      │  OpenAI, Gemini, OpenRouter,│
│  with an explicit --upload │      │  Azure, Ollama). BYO keys,  │
│  flag + signed-in session. │      │  encrypted at rest.          │
└───────────┬───────────────┘      └───────────┬───────────────┘
            │                                    │
            └──────────────┬─────────────────────┘
                            ▼
                  ┌───────────────────┐
                  │  Reports            │
                  │  Immutable JSON in  │
                  │  object storage     │
                  │  (R2), indexed in    │
                  │  D1. See docs/API.md │
                  └───────────────────┘
```

## Why a provider layer

Before this refactor, every screen (`src/App.tsx`) had numbers like
`Health Score = 92` baked directly into JSX. That made the UI a static
mockup: there was no seam where a real scanner or a real AI engine could be
plugged in without rewriting every screen.

The provider layer is that seam. The rule is simple and load-bearing:

> **A screen may only obtain domain data by calling a method on
> `useProviders()`. It may never import fixture data, compute a metric
> itself, or fetch a URL directly.**

This buys three things:

1. **Replaceability.** Swapping the mock registry for a `local-scanner` or
   `cloud-api` registry is a one-file change
   (`src/providers/index.tsx#resolveProviderRegistry`), because every
   screen already only depends on the interface, not an implementation.
2. **Uniform loading/empty/error states.** `ProviderResult<T>` and
   `<ProviderGate>` (`src/components/ProviderGate.tsx`) mean every screen
   handles "still scanning," "never scanned," and "scan failed" the same
   way, instead of each screen inventing its own ad-hoc handling (or, as
   before, having no such states at all because the data was hardcoded).
3. **A contract the scanner can target.** Because providers return the same
   shapes (`HealthSnapshot`, `StorageSnapshot`, ...) that make up
   `InspectionReport` (see [docs/API.md](docs/API.md)), the scanner spec
   and the UI were designed from the same type definitions
   (`src/types/index.ts`) instead of two teams inventing incompatible
   shapes independently.

## Module map

| Module | Path | Replaceable unit |
|---|---|---|
| Frontend | `src/pages`, `src/components`, `src/App.tsx` | Presentation only |
| Providers | `src/providers` | Data-access strategy (`mock` / `local-report` / `cloud-api`) |
| Shared Types | `src/types` | The one schema every layer agrees on |
| Utilities | `src/utils`, `src/hooks` | Pure helpers (compare, export formatting), no domain logic |
| Config | `src/config` | Navigation, environment-driven switches |
| API | `worker/index.ts`, `worker/routes`, `worker/lib` | Cloudflare Worker today; contract in `docs/API.md` is host-agnostic |
| Authorization | `worker/lib/rbac.ts` | One role→permission map every route and page checks — see `docs/RBAC.md` |
| Database | `d1/migrations` | D1 (SQLite): users (with role/status), sessions, devices, report summaries, encrypted BYO keys, audit log |
| Object storage | R2 via `worker/lib/r2.ts` | Immutable `InspectionReport` JSON + AI analysis companions |
| AI Layer | `worker/lib/ai` | One `AIProvider` interface, per-vendor files — swap vendors without touching the pipeline |
| Scanner | `scanner/` (macOS Storage implemented; Windows/Linux per `docs/SCANNER_SPEC.md`) | Local CLI producing one `InspectionReport`; collectors, signatures, rules as plain functions |

The scanner-side pipeline — collect → match known signatures → apply
rules → recommend → generate a reviewable cleanup script → optionally
narrate with AI — is specified in
[docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md), with the hard invariant
that **AI never makes a destructive decision**: rules decide, AI only
narrates an already-final recommendation list.

Every row is independently replaceable because every row's neighbors only
depend on a type or an interface, never an implementation. This applies to
the dashboard/API boundary, which is genuinely swapped today (mock vs.
future `local-scanner`/`cloud-api` providers) — it is deliberately *not*
extended one layer further into a plugin system inside the scanner itself
until there's a real second implementation that needs it.

## Extensibility

- **New device metric** (e.g. battery cycle count): add a field to the
  relevant snapshot type in `src/types/index.ts`, add it to the mock
  fixture, render it in the relevant page. No provider interface changes
  needed if it fits an existing snapshot; add a new provider interface only
  if it's a genuinely new category.
- **New platform for the scanner**: implement the collector interfaces in
  `docs/SCANNER_SPEC.md` for that OS. The API and dashboard need zero
  changes — they only ever see `InspectionReport` JSON.
- **New AI vendor**: the API's `/api/v1/ai/report` endpoint already takes
  `{ provider, model, apiKeyRef }` — adding a vendor is a server-side
  integration, not a schema change (see [docs/API.md](docs/API.md)).
- **Future enterprise features**: the intended extension point is a new
  provider implementation (e.g. a `TeamDashboardProvider`, see
  [docs/OPEN_CORE.md](docs/OPEN_CORE.md)) registered in
  `resolveProviderRegistry()` — no new mechanism needed, the provider
  pattern already covers it.
- **A real third-party plugin system, if it's ever needed**: deliberately
  not built now. `docs/SCANNER_DESIGN.md` keeps collectors, signatures,
  and rules as plain code in this repository on purpose — a manifest
  format, permission model, and sandboxed loader are real engineering cost
  that only pays off once outside contributors are actually shipping
  independent collectors. Add that layer when that's true, not in
  anticipation of it.

## Deployment shape

One Cloudflare Worker (`worker/index.ts`, configured in `wrangler.toml`)
serves everything: the built dashboard via the `ASSETS` binding and the
`/api/v1/*` REST API in the same process. Cloudflare services used, and
deliberately nothing more:

- **D1** — users, sessions, devices, report summaries, encrypted BYO API
  keys, audit log (`d1/migrations/`)
- **R2** — immutable `InspectionReport` JSON and AI analysis companions
- **KV** — rate-limit counters only (`worker/lib/ratelimit.ts`)
- **Not used, on purpose**: Queues (no background jobs exist — analysis
  completes within a request), Turnstile (magic-link + rate limiting
  covers current abuse surface), Images/Analytics (nothing to use them
  for). Each gets added when a concrete need appears, not before.

Every binding is optional at the type level (`worker/env.ts`): a route
missing its binding returns `501 not_configured` instead of crashing, so
the site deploys and serves the dashboard before any infrastructure is
provisioned. Setup, secrets, environments, and rollback:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Logging

Structured JSON lines to the Worker's console (`worker/lib/log.ts`),
tagged by category (`app` / `api` / `scanner` / `error`) with a per-request
id echoed in the `X-Request-Id` response header. Cloudflare captures
Worker console output natively (`wrangler tail`, dashboard Logs) — no
third-party logging service, consistent with [PRIVACY.md](PRIVACY.md).
Secrets, API keys, session tokens, and report contents are never logged.
