# Privacy Policy & Privacy-by-Design Principles

AI Check inspects your device to help you understand, optimize, and protect
it. This document is the definitive statement of what AI Check can and
cannot collect, and it constrains every future implementation — the
[Scanner Specification](docs/SCANNER_SPEC.md), [API Contract](docs/API.md),
and [Scanner Design](docs/SCANNER_DESIGN.md) are all written to be
consistent with the rules below. If any of them ever conflict with this
document, this document wins.

## Core principle

**AI Check collects metadata about your device, never the content of your
files.** A scanner result answers "how much space is Docker using" and "is
there an SSH key here that hasn't been reviewed" — never "what is in this
file" or "what does this document say."

## What AI Check never collects

Regardless of platform, mode (local-only or cloud-connected), or pricing
tier, AI Check will never read, store, transmit, or display:

- Passwords or password-manager contents
- Private keys, key material, or key *contents* (only presence/path/permission
  metadata about key files — see [Scanner Specification](docs/SCANNER_SPEC.md))
- Crypto wallet seed phrases, private keys, or wallet file contents
- The contents of documents, spreadsheets, or any personal files
- Photos, videos, or other media contents
- Email contents or email account credentials
- Browser history, bookmarks, or saved form data
- Any file's contents, full stop — only structural metadata (path, size,
  modified time, and for security checks, existence/permission bits) is
  ever collected

## What AI Check may collect (metadata only)

| Category | Examples of metadata collected |
|---|---|
| Storage | Folder paths, sizes, file counts, modification times |
| Security | Presence of key/credential files by filename and path, permission bits, certificate expiry dates — never key material |
| Performance | Aggregate CPU/memory/battery percentages |
| Developer environment | Installed tool names, version numbers, install sizes |
| Crypto | Presence of known wallet application bundles/extensions by known install path or bundle ID — never wallet files' contents |
| Device | Device name, OS/platform, OS version |

This is an allow-list, not an example list: a field is only ever added to
an `InspectionReport` (see [`src/types/index.ts`](src/types/index.ts)) if
it fits one of the rows above. Anyone proposing a new field in a PR should
expect to justify it against this table.

## Local-first by default

- The scanner runs on your device and produces a JSON report locally.
- **Nothing is transmitted anywhere unless you explicitly configure a
  submission target.** Dry-run/local-file mode is a first-class supported
  workflow, not an afterthought — see [ROADMAP.md](ROADMAP.md) v0.4.
- If you do submit a report to an API (self-hosted or Drave's hosted
  service), only the `InspectionReport` payload described in
  [API.md](docs/API.md) is sent — nothing beyond that schema.

## AI analysis is opt-in and provider-agnostic

- AI analysis (the "AI Report" screen) is a separate, explicit step from
  scanning. Your device metadata is not sent to any AI provider unless you
  request an AI report.
- AI Check is **AI-agnostic**: you may bring your own API key for the
  provider of your choice, or self-host analysis entirely. Drave does not
  bundle a single hardcoded AI vendor.
- Only the structured `InspectionReport` metadata (never raw file contents,
  because AI Check never collected them) is included in an AI analysis
  request.

## No telemetry by default

- The dashboard, scanner, and any local-only deployment send no analytics,
  crash reports, or usage telemetry unless explicitly enabled.
- If a future hosted tier adds optional product analytics, it will be
  opt-in, scoped to product-usage events (which screen was opened), and
  explicitly never mixed with device metadata from an `InspectionReport`
  without separate, explicit consent.

## Privacy by Design

Privacy constraints are enforced at the type level, not only in policy
text: `SecurityFinding` and `WalletFinding` (see
[`src/types/index.ts`](src/types/index.ts)) have no field capable of
holding a secret value — there is structurally nowhere to put one, so a
bug can't accidentally serialize a secret into a report. Rules only ever
see already-collected `Finding`s, never raw files (see
[docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md)), and the AI explanation
step only ever sees the final `Recommendation[]`, never raw collector
output — it physically cannot be sent data the pipeline didn't already
reduce to metadata.

## Privacy by Default

Every default configuration favors the more private option without
requiring the user to find a setting:

- Local-only/dry-run scanning is the default mode (see
  [ROADMAP.md](ROADMAP.md)) — cloud submission is something you turn on,
  not something you turn off.
- AI analysis is off until you request an "AI Report" or configure a
  provider — offline/no-AI mode is the natural behavior of an optional
  step, not a degraded one (see [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md)
  §AI).
- Cleanup review-groupings default to the most conservative reading: Yellow
  (Review) items are commented out by default in generated scripts, and
  Orange/Red items never appear as executable lines at all (see
  [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md) §Cleanup script
  generation).

## Data retention

- Self-hosted / local-only usage: retention is entirely up to you — AI
  Check open-source components do not phone home.
- Drave's optional hosted service (see [OPEN_CORE.md](docs/OPEN_CORE.md)):
  reports are retained only as long as needed to power the History and AI
  Report features, and are deletable on request. Exact retention windows
  will be published alongside the hosted service's terms of service before
  it launches — this document will be updated at that time, not
  retroactively softened.

## GDPR-friendly principles

- **Data minimization**: only metadata required to render a dashboard
  screen is ever collected (see the allow-list above).
- **Purpose limitation**: metadata collected for device health reporting is
  not repurposed for advertising, profiling, or resale. AI Check has no
  ad-supported tier.
- **User control / right to erasure**: any stored report is tied to a
  device/workspace the user controls and can be deleted on request.
- **Transparency**: the full scanner behavior is open source
  ([OPEN_CORE.md](docs/OPEN_CORE.md)) and auditable — nothing about data
  collection is hidden behind a closed binary.
- **No sensitive-category data**: AI Check's allow-list above contains no
  special category of personal data (health, biometric, etc.) by design.

## Reporting a privacy concern

If you believe AI Check (or a fork/derivative) collects more than this
document allows, please open a security-sensitive report following the
process in [SECURITY.md](SECURITY.md) rather than a public issue.
