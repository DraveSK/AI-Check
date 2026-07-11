# Changelog

All notable changes to this project are documented in this file. Format
loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — v0.5 Production SaaS Backend

### Added

- **Real REST API** on Cloudflare Workers (`worker/`): `/api/v1/auth/*`
  (magic link, verify, logout, me), `/api/v1/device`, `/api/v1/report`
  (upload/get/history/compare), `/api/v1/analyze`, `/api/v1/settings`,
  `/api/v1/providers` (BYO AI keys), `/api/v1/export` — consistent JSON
  envelopes, proper status codes, `X-Request-Id` on every response
- **D1 schema + migrations** (`d1/migrations/0001_init.sql`): users,
  sessions, magic_links, devices, reports, api_keys, settings,
  audit_logs — with indexes, FKs, and hash-only token storage
- **Magic-link authentication**: no passwords anywhere; HttpOnly/Secure/
  SameSite=Lax session cookies for the browser, the same token as Bearer
  auth for the scanner CLI; no-user-enumeration responses; rate limited
- **AES-256-GCM encryption** for stored BYO AI provider keys
  (`worker/lib/crypto.ts`, key from the `ENCRYPTION_KEY` secret); no
  endpoint ever returns a key
- **AI provider layer** (`worker/lib/ai/`): one `AIProvider` interface;
  Anthropic, OpenAI, Gemini, OpenRouter, Azure OpenAI, and Ollama
  implementations; structured-JSON responses only; provider failures
  degrade to `502` without affecting recommendations
- **Zod validation** (`worker/lib/validation.ts`) on every request body,
  including full `InspectionReport` validation on upload — invalid
  reports rejected, never partially stored
- **Rate limiting** via KV (`worker/lib/ratelimit.ts`): auth 5/15min/IP,
  uploads 30/hr, analysis 20/hr
- **Structured logging** (`worker/lib/log.ts`): JSON lines by category
  with request IDs; secrets/tokens/keys never logged
- **Scanner cloud pipeline**: `npm run login` (magic-link sign-in, session
  stored in `~/.ai-check/session.json` mode 0600) and
  `npm run scan -- --upload` (explicit opt-in upload)
- **Dashboard cloud mode**: `cloud-api` provider registry
  (`src/providers/cloud-api/`) + magic-link Login screen, active only
  when built with `VITE_PROVIDER_MODE=cloud-api`
- **CI** (`.github/workflows/ci.yml`): lint + 3-project typecheck + build
  on every PR/push; ESLint config added
- **Infra provisioning workflow**
  (`.github/workflows/provision-infra.yml`): idempotent one-click
  D1/R2/KV creation + migrations + binding commit + deploy trigger
- `docs/DEPLOYMENT.md` — full Cloudflare setup, secrets, environments,
  rollback, smoke test

### Changed

- Worker moved `src/worker.ts` → `worker/index.ts` with its own
  `tsconfig.worker.json` (Workers types) alongside `tsconfig.scanner.json`
  (Node types); `npm run typecheck` covers app + worker + scanner
- `src/utils/exportReport.ts` split: pure formatters now in
  `src/utils/exportFormat.ts` (DOM-free, shared with the Worker's export
  route), browser download trigger stays in `exportReport.ts`
- `docs/API.md` rewritten as the reference for the implemented API
- `ARCHITECTURE.md`, `SECURITY.md`, `PRIVACY.md`, `README.md`,
  `ROADMAP.md` updated to the production architecture

### Removed

- `functions/api/inspections.ts` — the last demo endpoint (unvalidated
  writes, hardcoded GET response). The dashboard's `mock` mode remains as
  the explicit local-development default, but there is no fake production
  path left.

## v0.4.5 Storage History & Comparison

### Added

- `scanner/history.ts` — saves every scan to `.ai-check-history/` (local,
  gitignored, never uploaded), with automatic pruning and a trimmed copy
  published to `public/` for the dashboard to fetch
- `src/utils/compareReports.ts` — pure `compareReports()` diff engine
  (new/removed/grown/shrunk folders, biggest growth/cleanup, recovered
  bytes, plain-text insights), plus `timeSince()` and
  `computeHistoryStats()`; shared by the CLI's terminal summary and the
  browser — one implementation, two call sites
- `src/utils/exportReport.ts` — JSON/Markdown/HTML export for a report, a
  comparison, or the full history, triggered by a plain browser download
- Overview: new "Storage changes" card (biggest growth/cleanup, total
  difference, recovered space, last scan, time since last scan) and a
  trend summary card
- New Scan History page (`src/pages/History.tsx`): cleanup statistics
  (total recovered, largest cleanup ever, average recovery, trend, scan
  count), a picker to compare any two of the last 20 scans, a color-coded
  before/after table (green = recovered, red = growth, gray = no change),
  and a full timeline
- `docs/HISTORY_FORMAT.md` — local history file format, `ComparisonResult`
  shape, retention/pruning, first-scan/single-scan handling

### Changed

- `DeviceInfo.model` (additive) — captured via `sysctl -n hw.model` on
  macOS
- `StorageSnapshot.tools` (additive) — every matched signature, not just
  the top-10 folders, so history comparisons can track e.g. Docker even
  when it isn't currently among the largest folders
- `HistoryEntry` (additive fields) — `usedBytes`, `totalBytes`,
  `reclaimableBytes`, `largestFolderLabel`, `largestFolderBytes`,
  `changeBytes`
- New `ComparisonResult` / `FolderDelta` / `ComparisonInsight` types —
  explicitly **not** part of the `InspectionReport` contract, exempt from
  `SCHEMA.md`'s versioning rules (see `docs/HISTORY_FORMAT.md`)
- `HistoryProvider` gained `getComparison(previousId, currentId)`
- **Fixed**: `formatBytes()` collapsed any negative value to `"0 B"`,
  silently hiding shrinkage in the Timeline and exports — now formats
  signed deltas correctly

### Notes

- Scan IDs are the report's `collectedAt` timestamp (filesystem-safe) —
  no new ID field was added to `InspectionReport`.
- Verified end-to-end on a real Mac: ran three real scans, including a
  reversible ~150 MB test file to exercise both growth and recovery
  paths; Overview, Storage Changes, and the History comparison view all
  showed correct real numbers.

## v0.4 Storage Analyzer MVP (macOS)

### Added

- `scanner/collectStorage.ts`, `scanner/fsSize.ts` — real macOS storage
  collector: target folders, bounded-depth recursion, metadata-only
  (`stat()`, never file contents), skips unreadable paths instead of
  failing the scan
- `scanner/signatures.ts` — known storage consumers (Docker, Homebrew,
  Flutter, Xcode, npm/yarn/pnpm/bun, pip, Cargo, Go, Gradle, VS Code,
  Chrome/Safari/Firefox, Zoom/Slack/Discord/Spotify, Dropbox/Google
  Drive/OneDrive/iCloud Drive)
- `scanner/rules.ts` — plain-function cleanup recommendations (large
  Downloads, large Trash, oversized known caches) with Safe/Review risk
  and a displayed, never-executed shell command
- `scanner/report.ts`, `scanner/cli.ts` — assembles a real
  `InspectionReport` and writes it to `public/ai-check-report.json`;
  `npm run scan` prints a terminal summary of largest folders and cleanup
  suggestions
- `src/providers/local-report` — provider registry reading the real report
  for Storage/Cleanup/Device, mock for everything not yet scanned;
  selected via `VITE_PROVIDER_MODE=local-report`
- `docs/NEXT_COLLECTOR.md` — how to add Security/Performance/Developer
  Environment/Crypto next, following this same five-piece pattern

### Changed

- `CleanupItem` (`src/types/index.ts`) gained an optional `command` field
  so a recommendation can carry its shell command through to the UI —
  additive, no other schema change (see `SCHEMA.md`)

### Notes

- macOS only. Windows and Linux collectors remain placeholders (see
  `docs/SCANNER_SPEC.md`).
- Only Storage is real. Security, Performance, Developer Environment,
  Crypto, AI Report, and History still read mock data even in
  `local-report` mode.
- No AI analysis, no rule engine, no plugin system — recommendations are
  plain TypeScript functions, matching `docs/SCANNER_DESIGN.md`.

## Simplification pass

### Removed

- Reverted the plugin/SDK/rule-engine/signature-database platform design
  from the previous unreleased entry: `sdk/`, `plugins/`, `rules/`,
  `signatures/` directories, and `docs/PLUGIN_SDK.md`,
  `docs/RULE_ENGINE.md`, `docs/SIGNATURE_DATABASE.md`,
  `docs/RECOMMENDATION_ENGINE.md`, `docs/CLEANUP_GENERATOR.md`,
  `docs/AI_INTEGRATION.md`, `docs/ENTERPRISE_ARCHITECTURE.md`,
  `docs/AUTOMATION.md`
- Plugin verification, sandbox model, permission model, and code-signing
  sections in `SECURITY.md`; plugin-specific sections in `PRIVACY.md`

### Added

- `docs/SCANNER_DESIGN.md` — one short document replacing all eight: same
  ideas (signatures, rules, risk levels, cleanup generation, AI-explains-
  never-decides) expressed as plain functions and data structures in one
  codebase instead of a plugin framework

### Why

A third-party plugin system with a manifest format, permission model, and
sandboxed loader is real, ongoing engineering cost. It only pays off once
outside contributors are actually shipping independent collectors — which
isn't true yet and doesn't need to be designed for in advance. `SCHEMA.md`
(versioning discipline for the one shared type) and `docs/OPEN_CORE.md`
(open/closed split) are kept because they're cheap and prevent real
mistakes; everything else from that pass is deferred until there's a
concrete need for it. See `docs/SCANNER_DESIGN.md` §"What we're
deliberately not building yet."

## v0.3.5 Platform Architecture & Plugin SDK (superseded, see above)

### Added

- `SCHEMA.md` — versioning, compatibility, deprecation, and migration
  policy for `InspectionReport` and every snapshot type
- `sdk/types.ts` — Plugin SDK type definitions: manifest, permissions,
  collector, analyzer, recommendation, cleanup action, lifecycle states
  (architecture only, no loader/runtime)
- `docs/PLUGIN_SDK.md` — plugin lifecycle, registration, discovery,
  loading, validation, security checklist, testing, publishing process
- `docs/SIGNATURE_DATABASE.md` — signature file format, versioning, update
  strategy, cross-platform support, community contribution process
- `docs/RULE_ENGINE.md` — declarative rule schema, condition types,
  conflict resolution, worked examples
- `docs/RECOMMENDATION_ENGINE.md` — full pipeline specification and the
  four-level risk classification model (Green/Yellow/Orange/Red)
- `docs/CLEANUP_GENERATOR.md` — safe/review/protected script generation
  design for macOS, Windows, and Linux
- `docs/AI_INTEGRATION.md` — multi-vendor AI provider interface (OpenAI,
  Anthropic, Gemini, OpenRouter, Ollama, Azure OpenAI); AI explains, rules
  decide
- `docs/ENTERPRISE_ARCHITECTURE.md` — future multi-device, team, policy,
  and audit-log design (not implemented)
- `docs/AUTOMATION.md` — future update-distribution design for signatures,
  rules, plugin catalog, and AI prompts (not implemented)
- `plugins/`, `rules/`, `signatures/`, `sdk/` folder skeleton with
  placeholder READMEs — no implementation

### Changed

- `SECURITY.md` expanded: plugin verification, checksum/tamper detection,
  sandbox model, permission model, future code signing, additional threat
  actors and mitigations, expanded audit checklist
- `PRIVACY.md` expanded: no-telemetry-by-default, plugin/third-party
  extension privacy constraints, Privacy by Design and Privacy by Default
  sections
- `ROADMAP.md` restructured: v0.4–v0.9 milestones rewritten around the
  plugin/rule/signature/recommendation pipeline; Phase-to-version mapping
  added
- `ARCHITECTURE.md` and `README.md` cross-link the new specs

### Notes

- No plugin loader, rule engine runtime, signature files, or AI provider
  integration were implemented in this release — this milestone is
  specification only, matching the discipline of v0.2 and v0.3.

## v0.2 Architecture

### Added

- Shared domain types for the full inspection report (`src/types`)
- Provider interfaces for every data domain: Health, Storage, Security,
  Performance, Developer Environment, Crypto, Cleanup, AI Report, History,
  Device (`src/providers/types.ts`)
- Mock provider registry replacing all previously hardcoded UI values
  (`src/providers/mock`)
- `useProviderData` hook and `ProviderGate` component for consistent
  loading/empty/error states across every screen
- `docs/API.md` — versioned REST contract for scanner submission, report
  retrieval, AI analysis, and cleanup script generation
- `docs/SCANNER_SPEC.md` — design-only specification for macOS, Windows,
  and Linux scanners
- `docs/OPEN_CORE.md` — documented open-source/closed-source split
- `PRIVACY.md`, `SECURITY.md`, `ARCHITECTURE.md`, `ROADMAP.md`
- GitHub community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `LICENSE` (MIT), issue templates, pull request template

### Changed

- `src/App.tsx` split into per-screen modules under `src/pages`, each
  sourcing data through providers instead of inline fixtures
- Byte values formatted via a shared `formatBytes` utility
  (`src/utils/format.ts`) instead of hand-authored strings per screen

### Notes

- No scanning, filesystem access, or native binaries were implemented in
  this release — see [ROADMAP.md](ROADMAP.md) v0.4 for that work.
- Visual design is unchanged from v0.1; this release is architecture-only.

## v0.1 — UI Prototype

- Initial dashboard: Overview, Storage Analyzer, Security Analyzer,
  Performance Analyzer, Developer Environment, Crypto Wallet Detector,
  Cleanup Recommendation, AI Report, Health Score, History, Settings
- Cloudflare Pages/Workers deployment scaffolding
- Brand assets and SEO metadata
