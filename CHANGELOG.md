# Changelog

All notable changes to this project are documented in this file. Format
loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — v0.4 Storage Analyzer MVP (macOS)

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
