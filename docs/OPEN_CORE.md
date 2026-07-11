# Open-Core Strategy

AI Check is open source first. This document defines exactly where the
open-source boundary sits, and — more importantly — *why* the architecture
in [ARCHITECTURE.md](../ARCHITECTURE.md) makes that boundary a clean seam
instead of a tangled fork.

## Split

### Open source (this repository, MIT-licensed)

- **Dashboard** — every screen in `src/pages`, the provider *interfaces*
  (`src/providers/types.ts`), the mock provider implementations, shared
  types (`src/types`)
- **Local Scanner** — the full implementation described in
  `docs/SCANNER_SPEC.md`, all platforms
- **JSON Report Generator** — the scanner's output pipeline, the schema
  itself (`InspectionReport`), and the cleanup script generator
- **Documentation** — this file, `ARCHITECTURE.md`, `API.md`,
  `SCANNER_SPEC.md`, `PRIVACY.md`, `SECURITY.md`, `ROADMAP.md`

A user can run 100% of this for free, forever, self-hosted, with zero
dependency on Drave's infrastructure: scan a device, view every dashboard
screen against a self-hosted API, generate cleanup scripts, and bring their
own AI API key for AI reports.

### Closed source / paid (not in this repository)

- **Cloud AI Analysis** — a hosted `/api/v1/ai/report` implementation that
  doesn't require the user to hold their own AI vendor key
- **Premium AI Models** — access to higher-tier models bundled into a
  subscription instead of BYO-key
- **Team Dashboard** — multi-user workspace views
- **Cloud History** — hosted, durable report history across devices, beyond
  what a self-hosted instance's operator wants to run themselves
- **Enterprise Management** — SSO, roles/permissions, audit logs, fleet
  policies
- **Billing** — subscription management, usage metering
- **API Usage (hosted)** — Drave's managed instance of the API contract in
  `API.md`, offered as a paid convenience over self-hosting

## How the split stays clean

The provider layer (`src/providers`) is the mechanism, not just a
description. Every closed-source capability above is reachable from the
open-source dashboard through **the same interfaces** the mock providers
implement today:

- `AIReportProvider` — the open-source mock implementation returns a
  canned insight. A closed-source `cloud-api` implementation calls Drave's
  hosted AI endpoint. A self-hoster's own implementation could call
  whatever they want. The dashboard code doesn't change in any case.
- A future `TeamProvider`/enterprise-only interface would follow the exact
  same registration pattern in `resolveProviderRegistry()`
  (`src/providers/index.tsx`) as `local-scanner` vs `mock` do today.

This means:

1. **No fork required** to build the paid product — it's an additional
   provider implementation living in a private repository/package,
   installed alongside this open-source dashboard, not a divergent copy of
   it.
2. **No feature is artificially crippled** in the open-source build to
   create upsell pressure — the open-source scanner and dashboard are
   fully functional on their own. The paid tier sells *convenience and
   scale* (hosted infra, premium models, team features), not withheld
   functionality.
3. **Contributors never touch closed code.** Anyone contributing to this
   repository is, by construction, only ever touching the open-source
   surface listed above.

## What this means for licensing

- This repository: **MIT** (see [LICENSE](../LICENSE)) — dashboard,
  scanner, report schema, docs.
- Anything closed-source lives in a separate, private repository that
  *depends on* the interfaces published here, and is never required to run
  the open-source parts.

## Guidance for contributors

If you're building a feature and unsure which side of the line it's on,
ask: *"Does this require Drave's infrastructure, or could a self-hoster do
this entirely on their own hardware with their own AI key?"* If the latter,
it belongs here, open source. If it inherently requires shared/hosted
infrastructure (a team's data crossing multiple users, billing, managed AI
capacity), it belongs in the closed-source counterpart, and this repository
should only need to expose the provider interface it will eventually
implement — see the pattern in `src/providers/types.ts`.
