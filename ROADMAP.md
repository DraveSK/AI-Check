# Roadmap

Status legend: ✅ done · 🚧 in progress · ⬜ not started

## v0.1 — UI Prototype ✅

- Dashboard screens (Overview, Storage, Security, Performance, Developer
  Environment, Crypto, Cleanup, AI Report, Health Score, History, Settings)
- Visual design system, dark/light mode, responsive layout
- Static demo data hardcoded directly in components

## v0.2 — Architecture ✅

- Shared domain types (`src/types`)
- Provider interfaces for every data domain (`src/providers/types.ts`)
- Mock provider registry replacing hardcoded constants (`src/providers/mock`)
- Loading / empty / error states on every screen (`ProviderGate`)
- API contract documented (`docs/API.md`)
- Privacy, security, and architecture documentation
- GitHub community readiness (contributing guide, code of conduct, license,
  issue/PR templates)
- Open-core split documented (`docs/OPEN_CORE.md`)
- **No real scanning. No filesystem access. No native binaries.** — out of
  scope by design for this phase.

## v0.3 — Scanner Design ✅

- `docs/SCANNER_SPEC.md`: per-platform (macOS/Windows/Linux) data sources,
  required permissions, security boundaries
- `SCHEMA.md`: `InspectionReport` version/compatibility/deprecation policy
  — frozen ahead of the first real collector
- `docs/SCANNER_DESIGN.md`: collectors, signature lookup, rules, cleanup
  script generation, and AI explanation — kept deliberately simple (plain
  functions and data structures in one codebase, not a plugin system) so
  it stays maintainable by a small team.

## v0.4 — Local Scanner MVP ✅ (macOS Storage only)

- `scanner/collectStorage.ts`: real macOS storage collector — target
  folders (Applications, Downloads, Desktop, Documents, Movies, Music,
  Pictures, Library, Caches, Application Support, Trash, Developer),
  metadata only, bounded recursion, skips unreadable paths without failing
  the scan
- `scanner/signatures.ts`: known storage consumers (Docker, Homebrew,
  Flutter, Xcode, npm/yarn/pnpm/bun, pip, Cargo, Go, Gradle, VS Code,
  browsers, chat/media apps, cloud-sync clients)
- `scanner/rules.ts`: plain-function recommendations (large Downloads,
  large Trash, oversized known caches) with Safe/Review risk and a
  displayed (never executed) cleanup command
- `npm run scan`: CLI that writes a real `InspectionReport` to
  `public/ai-check-report.json` and prints a terminal summary
- `local-report` provider (`src/providers/local-report`), selectable via
  `VITE_PROVIDER_MODE=local-report` — Storage Analyzer, the Overview
  storage/cleanup cards, and Cleanup Recommendation now show real data on
  the maintainer's own Mac; every other screen still reads mock data
- Windows and Linux remain placeholders — see `docs/SCANNER_SPEC.md`
- `docs/NEXT_COLLECTOR.md`: how to add Security/Performance/Developer
  Environment/Crypto next, following this exact pattern

## v0.5 — Security Collector ⬜

- Implement `SecuritySnapshot` collection for macOS per
  `docs/SCANNER_SPEC.md` and `docs/NEXT_COLLECTOR.md` — key/credential
  *presence* only, never contents, per `PRIVACY.md`
- Wire into `scanner/report.ts` and `local-report` provider the same way
  Storage was

## v0.6 — AI Explanation ⬜

- `POST /api/v1/ai/report` implemented against real recommendations, per
  `docs/SCANNER_DESIGN.md` §AI
- Bring-your-own-AI-key flow in Settings; one provider first (Anthropic or
  OpenAI), more added only if users actually ask for a second one
- Offline/no-AI fallback path exercised explicitly, not just specified

## v0.7 — Cleanup Script Generator ⬜

- `POST /api/v1/cleanup/script` implementation
- Shell (macOS/Linux) and PowerShell (Windows) output for the platforms
  supported by v0.4/v0.4.x scanners
- Explicit review-then-run UX in the dashboard (never auto-executed)

## v0.8 — Security Inspection ⬜

- Full security collector implementation across all three platforms per
  `docs/SCANNER_SPEC.md`
- First external security review pass against `SECURITY.md`'s audit
  checklist

## v1.0 — Stable Release ⬜

- All three platforms fully supported end-to-end (scan → rules →
  recommendations → AI explanation → cleanup)
- Security audit checklist in `SECURITY.md` fully checked off
- Versioned, documented API with a published deprecation policy (per
  `SCHEMA.md`)
- Public release binaries with reproducible builds

---

Enterprise features (multi-device, team dashboard, policy engine) and any
third-party plugin system are intentionally not on this roadmap. They get
designed when there's a concrete need for them — a paying customer or an
outside contributor actually blocked without one — not before. See
[docs/OPEN_CORE.md](docs/OPEN_CORE.md) for the open/closed split to keep in
mind if that day comes.

Milestones are sequential in priority, not strictly in delivery order —
e.g. Linux scanner work can start before Windows is fully complete if
contributor interest points that way. Open an issue/discussion to propose
reordering; see [CONTRIBUTING.md](CONTRIBUTING.md).
