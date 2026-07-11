# Schema Versioning Policy

`InspectionReport` (defined once in [`src/types/index.ts`](src/types/index.ts))
is the single most load-bearing contract in AI Check: the dashboard, the
API, and every collector agree on it. This document freezes how that
contract is allowed to change so that code written against it today keeps
working years from now.

This document governs `InspectionReport` and every snapshot type it is
composed of (`StorageSnapshot`, `SecuritySnapshot`, `PerformanceSnapshot`,
`DeveloperEnvironmentSnapshot`, `CryptoSnapshot`, `CleanupSnapshot`,
`AIReportSnapshot`, `HealthSnapshot`, `HistoryEntry`, `DeviceInfo`), and by
extension any future snapshot type a new collector category introduces.

## Version policy

- `InspectionReport.schemaVersion` is a `"MAJOR.MINOR"` string (currently
  `"1.0"`). There is no patch component — non-breaking clarifications to
  this document don't require a schema bump.
- **MINOR** bump: additive, backward-compatible change. Existing consumers
  (dashboard, API) continue to work unmodified.
- **MAJOR** bump: breaking change. Requires the migration process below and
  a deprecation window on the old major version.

## Compatibility policy

A change is **additive (MINOR)** if and only if it is one of:

- A new optional field on an existing snapshot type
- A new snapshot type entirely (e.g. a future `NetworkSnapshot`), added as
  an optional top-level field on `InspectionReport`
- A new enum member on a field that consumers are required to treat
  exhaustively-unknown-tolerant (see "Forward-compatible consumption"
  below) — e.g. adding `'critical'` alongside existing `Severity` values is
  additive because consumers must already have a default case

A change is **breaking (MAJOR)** if it:

- Removes or renames a field
- Changes a field's type (including widening a union in a way that changes
  meaning, e.g. `risk: 'Safe' | 'Review'` gaining a value that changes what
  "unhandled" means for existing switch statements written before this
  policy existed)
- Changes the semantic meaning of an existing field without changing its
  name (e.g. redefining `bytes` to mean something other than raw byte
  count) — renamed instead, never silently redefined
- Makes a previously-optional field required

## Forward-compatible consumption (required of every consumer)

Every consumer of `InspectionReport` — dashboard providers, API validators,
collectors — **must** be written to ignore unknown fields and
tolerate unknown enum members with a default/fallback branch, never an
exhaustive switch that throws on an unrecognized value. This is what makes
MINOR bumps genuinely non-breaking in practice, not just on paper. PR review
should reject any new `switch` over a schema enum without a `default`.

## Deprecation strategy

1. A field or type slated for removal is marked `@deprecated` in
   `src/types/index.ts` with a comment pointing to its replacement and the
   MAJOR version it will be removed in.
2. Deprecated fields are still populated by producers (collectors/API) for
   at least one full MAJOR version cycle after being marked, so consumers
   have a real window to migrate, not just a warning.
3. Removal only happens on a MAJOR bump, never a MINOR one, regardless of
   how long something has been deprecated.

## Migration strategy

When a MAJOR bump is unavoidable:

1. The new major version is introduced as `schemaVersion: "2.0"` while
   `"1.x"` continues to be accepted by the API for a published overlap
   window (minimum one full Phase/roadmap milestone — see
   [ROADMAP.md](ROADMAP.md)).
2. The API (`docs/API.md`) accepts both versions during the overlap window
   and normalizes internally; it never silently coerces a `2.0` report to
   look like `1.x` or vice versa.
3. A migration note is added to [CHANGELOG.md](CHANGELOG.md) describing the
   exact field-level diff and the reason a MINOR bump wasn't sufficient.
4. Old-version scanners keep working until the overlap window closes —
   they are never broken by a server-side deploy alone.

## Extension rules for new snapshot types

A new collector category (e.g. network, cloud storage, browsers) that
wants to contribute a new top-level snapshot to `InspectionReport` must:

1. Define its snapshot type following the existing naming convention
   (`<Category>Snapshot`) and the `ProviderResult<T>` envelope pattern used
   by every other domain (see [ARCHITECTURE.md](ARCHITECTURE.md)).
2. Add the field to `InspectionReport` as **optional** — this is what keeps
   adding a category a MINOR bump instead of a MAJOR one, and what lets a
   report from a device that didn't run that collector remain valid.
3. Go through review against this document (specifically the "additive"
   test above) before merging — see [CONTRIBUTING.md](CONTRIBUTING.md).
4. Never repurpose an existing field's meaning to shoehorn in new data —
   add a new field instead, even if it looks similar to an existing one.

## What is explicitly frozen as of `1.0`

These are committed to indefinitely under the compatibility policy above —
changing any of the following requires a MAJOR bump and the full migration
process:

- The five required top-level fields: `schemaVersion`, `device`,
  `collectedAt`, `scannerVersion`, and the presence of at least a
  `storage` and `security` snapshot (the two categories present since
  `0.1`)
- The `Severity` type's existing four values (`'info' | 'good' | 'review' |
  'warning'`) keep their current meaning; `'critical'` was added as an
  additive MINOR change and existing values are never redefined
- Byte fields are always raw integers, never formatted strings (see
  [ARCHITECTURE.md](ARCHITECTURE.md) "Conventions")
- The `ProviderResult<T>` envelope shape (`status`, `data`, `error`,
  `generatedAt`, `source`)

## Where the schema actually lives

`src/types/index.ts` is the single source of truth. This document describes
*how it's allowed to change*, not a duplicate of its contents — always read
the type file for the current shape, and `docs/API.md` for how it's carried
over the wire.
