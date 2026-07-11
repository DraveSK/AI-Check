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
│  Today: `mock` registry (src/providers/mock). Future:         │
│  `local-scanner` and `cloud-api` registries, selected by       │
│  VITE_PROVIDER_MODE, with no change to any screen.             │
└───────────────────────────┬────────────────────────────────┘
                             │ HTTPS (cloud-api provider only)
┌───────────────────────────▼────────────────────────────────┐
│  API (functions/api/*, src/worker.ts)                         │
│  Stable REST contract — see docs/API.md. Validates and        │
│  stores InspectionReports, serves them back to providers,     │
│  brokers AI analysis requests. Cloudflare Pages Functions /    │
│  Worker today; contract is host-agnostic.                     │
└───────────┬─────────────────────────────────┬───────────────┘
            │ POST /api/v1/inspections          │ POST /api/v1/ai/report
┌───────────▼───────────────┐      ┌───────────▼───────────────┐
│  Scanner (design only —    │      │  AI Engine (not built)     │
│  see docs/SCANNER_SPEC.md) │      │  Bring-your-own-AI:         │
│  Local, read-mostly CLI.   │      │  provider + model + API     │
│  Produces one              │      │  key supplied by caller,    │
│  InspectionReport JSON     │      │  never hardcoded to a        │
│  per platform.             │      │  single vendor.              │
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
| Providers | `src/providers` | Data-access strategy (mock / local-scanner / cloud-api) |
| Shared Types | `src/types` | The one schema every layer agrees on |
| Utilities | `src/utils`, `src/hooks` | Pure helpers, no domain logic |
| Config | `src/config` | Navigation, environment-driven switches |
| API | `functions/api`, `src/worker.ts` | Cloudflare today; contract in `docs/API.md` is host-agnostic |
| Scanner | *(not yet implemented — see `docs/SCANNER_SPEC.md` and `docs/SCANNER_DESIGN.md`)* | Per-OS binary producing one JSON schema; collectors, signatures, rules, and AI explanation live as plain functions in one codebase — see "Extensibility" below for why this stays that simple |

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

## Deployment shape (current)

Cloudflare Pages/Workers, static assets served by a Worker with an
`ASSETS` binding, D1 reserved for report metadata, R2 for immutable JSON
report bodies (`wrangler.toml`, `src/worker.ts`). See the "Recommended
Cloudflare deployment architecture" section of the Phase 1 final report for
the target production topology.
