# Storage History & Comparison Format

Status: **implemented** (macOS Storage only — see
[docs/NEXT_COLLECTOR.md](NEXT_COLLECTOR.md) for what isn't scanned yet).
This document describes the on-disk history format `npm run scan` writes
and the derived `ComparisonResult` shape the dashboard computes from it.

## Why local files, no database

Same reasoning as [docs/SCANNER_DESIGN.md](SCANNER_DESIGN.md): one user,
one machine, a few hundred scans at most. A JSON file per scan plus a
summary index is simpler to read, debug, and back up than a database file
would be, and it costs nothing to keep that way — see
[docs/SCANNER_DESIGN.md](SCANNER_DESIGN.md) §"What we're deliberately not
building yet."

## Where history lives

```
.ai-check-history/          durable, local-only, never uploaded, gitignored
  index.json                 array of HistoryEntry, newest first
  reports/
    2026-07-11T09-15-18-458Z.json   one full InspectionReport per scan

public/                      trimmed copies the dashboard (browser) can fetch
  ai-check-history-index.json       last 100 HistoryEntry summaries
  ai-check-history/
    2026-07-11T09-15-18-458Z.json   last 20 full reports only
```

`public/` exists because the dashboard is a static SPA running in a
browser — it can only `fetch()` static files, not read
`.ai-check-history/` on disk directly. The browser never sees more than
what's published there; see [PRIVACY.md](../PRIVACY.md) — nothing in
either location is ever uploaded anywhere by AI Check itself.

Both locations are gitignored. This is your data, on your machine.

## Scan IDs

A scan's `id` is its `collectedAt` timestamp with `:` and `.` replaced by
`-` (filesystem-safe), e.g. `2026-07-11T09-15-18-458Z`. No separate ID
field was added to `InspectionReport` for this — the timestamp is already
unique per scan and this keeps `SCHEMA.md`'s frozen fields untouched. See
`scanner/history.ts` `scanIdFor()`.

## `HistoryEntry` (the index format)

One entry per scan, cheap to load in bulk (no full report needed for the
Timeline or Overview's "Storage changes" card to render). Defined in
[`src/types/index.ts`](../src/types/index.ts):

```jsonc
{
  "id": "2026-07-11T09-15-18-458Z",
  "deviceName": "Drave",
  "inspectedAt": "2026-07-11T09:15:18.458Z",
  "healthScore": 28,
  "usedBytes": 357578973184,
  "totalBytes": 494384795648,
  "reclaimableBytes": 0,
  "largestFolderLabel": "Applications",
  "largestFolderBytes": 14798581190,
  "changeBytes": -157286400
}
```

`healthScore` here is a **storage-only proxy** (`100 - capacityPercent`),
not a real overall health score — Security and Performance aren't scanned
yet (see [docs/NEXT_COLLECTOR.md](NEXT_COLLECTOR.md)). It will be replaced
by the real `HealthProvider` calculation once those collectors exist;
until then, don't read too much into small changes in this number.

`changeBytes` is the signed difference in `usedBytes` versus the scan
immediately before it, computed once at scan time and stored — `undefined`
on the very first scan (nothing to compare against). This is what lets the
Timeline and `computeHistoryStats()` (see
[`src/utils/compareReports.ts`](../src/utils/compareReports.ts)) work
without loading full reports.

## `ComparisonResult` (derived, not stored)

Nothing pre-computes and stores a full comparison — it's cheap to derive
from two `InspectionReport`s on demand, so it's computed on the fly:

- **`npm run scan`** computes it once (previous vs. the scan that just
  ran) purely for its terminal summary.
- **The dashboard** computes it client-side, in the browser, whenever the
  History page's compare picker changes — it fetches the two full reports
  from `public/ai-check-history/<id>.json` and calls the exact same
  `compareReports()` function.

Same pure function, two call sites, one implementation
([`src/utils/compareReports.ts`](../src/utils/compareReports.ts)) — see
[ARCHITECTURE.md](../ARCHITECTURE.md) for why sharing logic this way beats
maintaining two.

```ts
interface ComparisonResult {
  previous: { id: string; collectedAt: string };
  current: { id: string; collectedAt: string };
  newFolders: StorageFolder[];       // present now, absent before
  removedFolders: StorageFolder[];   // present before, absent now
  grown: FolderDelta[];               // grew by more than the threshold
  shrunk: FolderDelta[];              // shrank by more than the threshold
  unchanged: FolderDelta[];           // within the threshold either way
  biggestGrowth: FolderDelta | null;
  biggestCleanup: FolderDelta | null;
  totalDeltaBytes: number;            // signed — current.usedBytes - previous.usedBytes
  recoveredBytes: number;             // always >= 0 — sum of all shrinkage
  insights: ComparisonInsight[];      // plain-text messages, e.g. "Docker grew by 12 GB..."
}
```

`ComparisonResult` is **not** part of the `InspectionReport` contract and
is explicitly exempt from [SCHEMA.md](../SCHEMA.md)'s versioning
guarantees — it's a derived view computed fresh every time, never
serialized as a stored artifact, so there's nothing to keep
backward-compatible.

### What gets compared

Two sources are merged before diffing, keyed by filesystem path:

1. `storage.largestFolders` — the top-10 target folders (Applications,
   Downloads, etc.)
2. `storage.tools` — **every** matched signature (Docker, Homebrew, npm
   cache, ...), regardless of size, not just the top 10

`storage.tools` exists specifically so a tool like Docker can be tracked
across scans even in a period where it isn't one of the 10 largest
folders on disk. See the additive `StorageToolMeasurement[]` field on
`StorageSnapshot` in [`src/types/index.ts`](../src/types/index.ts).

### Threshold

Changes smaller than **100 MB** (`CHANGE_THRESHOLD_BYTES` in
`compareReports.ts`) are classified `unchanged` — filesystem/cache noise,
not a real trend. This is a single constant, not a per-folder
configuration; change it in one place if 100 MB turns out to be wrong.

## Retention & pruning

| Location | Kept |
|---|---|
| `.ai-check-history/` (local, durable) | last 200 scans |
| `public/ai-check-history-index.json` | last 100 scan summaries |
| `public/ai-check-history/` (full reports) | last 20 scans |

Pruning happens automatically on every `npm run scan` — see
`scanner/history.ts` `saveToHistory()` / `publishForDashboard()`. Report
files are deleted before their index entry is dropped, so a crash mid-run
never leaves a dangling reference.

**Consequence for comparison**: the History page's compare picker can only
select from the last 20 scans (the published full reports). Picking two
scans where one has aged out returns `status: 'empty'` from
`getComparison()` — handled the same way as "not enough history yet," per
[SCHEMA.md](../SCHEMA.md)'s pattern for `ProviderResult`, never as an
error.

## First scan / single scan

- Zero scans: `HistoryProvider.getHistory()` returns
  `status: 'empty'` — the dashboard shows "This is your first scan."
- One scan: history renders, but nothing has a `changeBytes`/comparison
  yet — the compare UI is hidden rather than shown broken (see
  `src/pages/Overview.tsx` and `src/pages/History.tsx`).
- Two or more: full comparison, defaulting to the two most recent scans.

## Export

`src/utils/exportReport.ts` turns a report, a comparison, or the history
list into JSON, Markdown, or HTML — all client-side string formatting, no
backend, triggered by a plain browser download
(`URL.createObjectURL` + `<a download>`). Nothing is uploaded as part of
exporting; the file only goes wherever the browser's download dialog
saves it.
