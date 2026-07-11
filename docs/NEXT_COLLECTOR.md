# Adding the Next Collector

This is the pattern the Storage collector (`scanner/`) established. Follow
it for Security, Performance, Developer Environment, or Crypto — don't
introduce a new abstraction to do it; each of those is the same shape as
Storage, just different paths and a different snapshot type.

## The pattern, in five files

Storage did it in exactly these pieces. A new collector adds the same five:

1. **A measurement function** (`scanner/collectStorage.ts` is the model) —
   walks/measures whatever the category needs and returns the matching
   snapshot type from [`src/types/index.ts`](../src/types/index.ts)
   (`SecuritySnapshot`, `PerformanceSnapshot`, etc.). Metadata only — see
   [PRIVACY.md](../PRIVACY.md). Every filesystem read must be wrapped so a
   permission error or missing path is skipped, never thrown (see
   `scanner/fsSize.ts` for the pattern).
2. **A signatures list**, if the category needs one (`scanner/signatures.ts`
   is the model) — a plain array of known things to detect, not a database.
   Security might not need this at all; Developer Environment will look
   a lot like Storage's list.
3. **Recommendation functions**, if the category produces cleanup/review
   items (`scanner/rules.ts` is the model) — plain functions over measured
   data, returning `CleanupItem[]`. Not every category needs this: Security
   findings, for example, might just populate `SecuritySnapshot.findings`
   directly with no separate recommendation step.
4. **Wire it into `scanner/report.ts`** — replace the relevant empty
   placeholder (e.g. `security: { malwareIndicatorsFound: false, ... }`)
   with a real call to your new measurement function.
5. **Wire it into the provider** — add the new snapshot to
   `src/providers/local-report/index.ts`'s `fromReport()` calls, replacing
   that one field's inheritance from `mockProviders`. No other file
   changes; the dashboard already renders from providers (see
   [ARCHITECTURE.md](../ARCHITECTURE.md)).

That's it. No plugin manifest, no loader, no registry — see
[docs/SCANNER_DESIGN.md](SCANNER_DESIGN.md) for why.

## Security collector specifically — read this first

Security is the next logical target (see [ROADMAP.md](../ROADMAP.md)), and
it's the one where privacy discipline matters most. Before writing it:

- Re-read [PRIVACY.md](../PRIVACY.md)'s allow-list. A Security collector
  may report *presence* of an SSH key, its path, and its permission bits —
  never the key's contents.
- Never call anything that reads Keychain *values* — enumerating item
  *labels* (if you do this at all) is the ceiling. See
  [docs/SCANNER_SPEC.md](SCANNER_SPEC.md) for the macOS-specific note on
  `SecItemCopyMatching` with attributes only.
- Findings for sensitive categories (SSH keys, wallets, certificates) get
  `status: 'review'` or stricter, never `'good'` by default, and are never
  fed into a cleanup recommendation — Storage's `rules.ts` shows the
  pattern for skipping `riskLevel === 'Protected'` from cleanup output;
  Security findings about key material should follow the same instinct
  even without formal risk levels on `SecurityFinding` yet.

## What not to do

- Don't add a manifest, a permission enum, or a loader "to match the
  pattern established for plugins" — that pattern was deliberately removed
  (see [CHANGELOG.md](../CHANGELOG.md) "Simplification pass"). One
  collector per category, in this repository, reviewed as a normal PR.
- Don't build a generic "collector registry" that iterates over an array of
  collector objects until there are enough collectors that the `if
  (platform === ...)` branches in `scanner/report.ts` actually get
  unwieldy. Two or three collectors called explicitly is more readable
  than one generic loop.
- Don't touch `src/pages/*` or `src/components/*`. If a screen needs a UI
  change to show new data, that's a separate, explicit decision — adding a
  collector should never require it, because the screens already render
  whatever their provider returns.
