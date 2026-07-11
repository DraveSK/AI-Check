# AI Check — API Contract

This document is the stable contract between the **dashboard**, the **local
scanner**, and the **API**. It is versioned independently of the UI: the
dashboard must never assume anything about the API beyond what is written
here, and the scanner must never emit a payload that doesn't validate
against the `InspectionReport` schema in [`src/types/index.ts`](../src/types/index.ts).

Status: **Draft — Phase 1 (architecture only). No endpoint below is backed by
a real scanner or AI engine yet**; `functions/api/inspections.ts` and
`src/worker.ts` currently return static demo data or persist whatever JSON
they're given, unvalidated. Phase 2 replaces the demo bodies with real
implementations behind these exact same routes.

## Conventions

- Base path: `/api/v1` (current demo code predates versioning and lives at
  `/api/inspections`; Phase 2 introduces the `/v1` prefix — see
  [ROADMAP.md](../ROADMAP.md)).
- All bodies are JSON. `Content-Type: application/json` is required on every
  request with a body.
- All responses use the envelope:
  ```json
  { "data": { }, "meta": { "generatedAt": "2026-07-11T09:41:00Z", "source": "local-scanner" } }
  ```
  or, on failure:
  ```json
  { "error": { "code": "invalid_report", "message": "human-readable message" } }
  ```
- Timestamps are ISO 8601 UTC. Byte counts are always raw integers (bytes),
  never pre-formatted strings — formatting is a UI concern
  ([`src/utils/format.ts`](../src/utils/format.ts)).
- Authentication (Phase 2+): a bearer token (`Authorization: Bearer <token>`)
  tied to a workspace. The open-source local scanner may also run in
  "unauthenticated local mode" against a self-hosted API with no cloud
  component at all.

## Endpoints

### `POST /api/v1/inspections`

Submitted by the **scanner** after a completed local scan. This is the one
endpoint that is contract-critical: its request body **is**
`InspectionReport` (see [`src/types/index.ts`](../src/types/index.ts)).

Request body:

```jsonc
{
  "schemaVersion": "1.0",
  "device": { "id": "uuid", "name": "MacBook Pro", "platform": "macos", "osVersion": "macOS Sequoia 15.2", "lastInspectedAt": null },
  "storage": { "totalBytes": 0, "usedBytes": 0, "availableBytes": 0, "capacityPercent": 0, "reclaimableBytes": 0, "categories": [], "largestFolders": [] },
  "security": { "malwareIndicatorsFound": false, "itemsNeedingReview": 0, "findings": [] },
  "performance": { "cpuPercent": 0, "memoryPercent": 0, "sparkline": [], "metrics": [] },
  "developerEnvironment": { "toolCount": 0, "totalBytes": 0, "tools": [] },
  "crypto": { "walletsDetected": 0, "wallets": [] },
  "cleanup": { "totalReclaimableBytes": 0, "items": [] },
  "collectedAt": "2026-07-11T09:41:00Z",
  "scannerVersion": "0.4.0"
}
```

Response `201`:

```json
{ "data": { "id": "report-uuid", "accepted": true }, "meta": { "generatedAt": "..." } }
```

Errors: `400 invalid_report` (schema validation failed — reject, do not
partially store), `401 unauthorized`, `413 payload_too_large`.

Server-side rules:

- Validate the full payload against the `InspectionReport` schema before
  persisting anything. Never trust `schemaVersion` alone — validate shape.
- Store the raw payload immutably (R2, see [ARCHITECTURE.md](../ARCHITECTURE.md)); never mutate a submitted
  report in place. Corrections are new reports.
- Never inspect, log, or forward the contents of `security.findings[].detail`
  or any field to a third party without the explicit AI-analysis opt-in
  described in [PRIVACY.md](../PRIVACY.md).

### `GET /api/v1/inspections/latest?deviceId=`

Returns the most recent `InspectionReport` for a device. This is what
`HealthProvider`, `StorageProvider`, etc. call in a `cloud-api` provider
implementation (see [`src/providers/types.ts`](../src/providers/types.ts)).

Response `200`:

```json
{ "data": { "...InspectionReport" }, "meta": { "generatedAt": "...", "source": "cloud-api" } }
```

Response `404` (`no_reports`) if the device has never submitted a report —
providers must map this to `ProviderResult.status = 'empty'`, not `'error'`.

### `GET /api/v1/inspections/history?deviceId=&limit=`

Returns a list of lightweight `HistoryEntry` records (id, device name,
timestamp, health score) — never full reports, to keep the endpoint cheap.
Backs `HistoryProvider`.

### `POST /api/v1/ai/report`

Triggers AI analysis of a stored inspection report and returns an
`AIReportSnapshot`. This is the paid/closed-source boundary described in
[OPEN_CORE.md](../OPEN_CORE.md) — the open-source `AIReportProvider` mock
implementation never calls this endpoint; a `cloud-api` provider does.

Because AI Check is **AI-agnostic**, the request lets the caller specify
which provider/key to use — the API never bundles a hardcoded model:

```json
{
  "reportId": "report-uuid",
  "ai": { "provider": "anthropic", "model": "claude-sonnet-5", "apiKeyRef": "byo-key-id" }
}
```

`apiKeyRef` references a key the user registered with their own workspace
(bring-your-own-key) or, in the hosted paid tier, is omitted and Drave's
managed key is used instead. Response is an `AIReportSnapshot`.

### `POST /api/v1/cleanup/script`

Given a `CleanupSnapshot` (or reportId), generates a reviewable shell/PowerShell
script that performs the selected safe deletions. Returns the script as text
plus a checksum — **the API never executes anything on the user's machine**;
execution always happens locally, initiated by the user.

### `GET /api/v1/devices`

Lists devices in the caller's workspace (Phase 2+, requires auth).

## Non-goals for this API

- The API never receives file contents, only metadata described by the
  `InspectionReport` schema (see [PRIVACY.md](../PRIVACY.md) for the exact
  allow-list).
- The API never issues commands back to the scanner. The relationship is
  strictly scanner → API (submit) and dashboard → API (read), never
  API → scanner (push/RPC). This keeps the scanner a simple, auditable CLI
  with no listening network port.
