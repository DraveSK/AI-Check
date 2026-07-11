# AI Check — API Reference

Status: **implemented.** Every endpoint below is live code in
[`worker/routes/`](../worker/routes), served by the Cloudflare Worker
([`worker/index.ts`](../worker/index.ts)) alongside the dashboard's static
assets. Requests are validated with Zod
([`worker/lib/validation.ts`](../worker/lib/validation.ts)) — never
trusted as-is.

## Conventions

- Base path: `/api/v1`. Breaking changes get `/api/v2`, never a silent
  change to v1 — same discipline as [SCHEMA.md](../SCHEMA.md).
- All bodies are JSON; `Content-Type: application/json` required on every
  request with a body.
- Success envelope:
  ```json
  { "data": { }, "meta": { "generatedAt": "2026-07-11T09:41:00Z" } }
  ```
  Error envelope:
  ```json
  { "error": { "code": "invalid_report", "message": "...", "details": [] } }
  ```
- Error codes → HTTP status (see [`worker/lib/http.ts`](../worker/lib/http.ts)):
  `invalid_request`/`invalid_report` → 400, `unauthorized` → 401,
  `forbidden` → 403, `not_found` → 404, `rate_limited` → 429,
  `internal_error` → 500, `not_configured` → 501 (a required Cloudflare
  binding isn't provisioned yet — see [DEPLOYMENT.md](DEPLOYMENT.md)),
  `upstream_error` → 502 (an AI provider call failed).
- Every response includes an `X-Request-Id` header; quote it when
  reporting a problem.
- Timestamps are ISO 8601 UTC. Byte counts are raw integers, never
  formatted strings.
- Internal models are never exposed: every route returns an explicit
  field whitelist (`pick()` in `worker/lib/http.ts`), not raw DB rows.

## Authentication

Magic-link only — no passwords exist anywhere in the system.

Two session transports resolve through the same `sessions` table:

- **Browser**: HttpOnly, Secure, SameSite=Lax cookie set by
  `GET /auth/verify` (30-day expiry).
- **Scanner CLI**: the same opaque token sent as
  `Authorization: Bearer <token>` (obtained via `npm run login`, stored in
  `~/.ai-check/session.json` with mode 0600).

Only SHA-256 hashes of tokens are stored server-side
(`d1/migrations/0001_init.sql`) — a leaked database is not enough to
hijack a session.

### `POST /api/v1/auth/magic-link`

Body: `{ "email": "you@example.com" }`. Always returns
`200 { "data": { "sent": true } }` regardless of whether the address is
registered — no user enumeration. Rate limited (5 / 15 min / IP). Links
expire in 15 minutes and are single-use. Without `RESEND_API_KEY`
configured, the link is logged to the Worker console instead of emailed
(dev mode — see [`worker/lib/email.ts`](../worker/lib/email.ts)).

### `GET /api/v1/auth/verify?token=...`

Browser: consumes the token, sets the session cookie, 302-redirects to
`/`. With `Accept: application/json` (the scanner CLI):
`200 { "data": { "sessionToken", "expiresAt", "email" } }`.

### `POST /api/v1/auth/logout` · `GET /api/v1/auth/me`

Logout deletes the session and clears the cookie. `me` returns
`{ id, email, created_at }` or `401`.

## Devices

### `GET /api/v1/device` 🔒

Devices the user has uploaded reports from. Devices are created
implicitly by report upload (unique per user + name + platform) — there
is no separate registration step to get wrong.

## Reports

### `POST /api/v1/report` 🔒

The scanner's upload endpoint (`npm run scan -- --upload`). Body is one
`InspectionReport` (see [`src/types/index.ts`](../src/types/index.ts)),
validated in full before anything persists — an invalid report is
rejected with `400 invalid_report` + per-field details, never partially
stored. Raw JSON goes to R2 (`reports/<userId>/<reportId>.json`,
immutable); a queryable summary row goes to D1. Rate limited
(30 / hour / user). Returns
`201 { "data": { "id", "deviceId", "accepted": true } }`.

### `GET /api/v1/report/:id` 🔒

The full stored `InspectionReport`. Scoped to the signed-in user — you
can never fetch another user's report, enforced in the D1 query itself.

### `GET /api/v1/report/history?deviceId=` 🔒

Lightweight summaries (id, device, bytes, timestamps), never full
reports — the same index-vs-payload split as the local scanner's history
(see [HISTORY_FORMAT.md](HISTORY_FORMAT.md)).

### `GET /api/v1/report/compare?previousId=&currentId=` 🔒

Returns a `ComparisonResult`. Runs the exact same pure `compareReports()`
used by the dashboard and the scanner CLI
([`src/utils/compareReports.ts`](../src/utils/compareReports.ts)) — one
diff implementation, three call sites.

## AI Analysis

### `POST /api/v1/analyze` 🔒

Body: `{ "reportId", "provider", "model" }`. Provider is one of
`anthropic | openai | gemini | openrouter | azure-openai | ollama`. The
pipeline (see [`worker/lib/ai/`](../worker/lib/ai)):

```
stored InspectionReport → prompt from already-final cleanup items
  → provider call (structured JSON response, not free-form prose)
  → validated StructuredAnalysis → AIReportSnapshot (+ stored in R2)
```

AI **explains, never decides** — the response shape has no way to add,
remove, or reclassify a recommendation (see
[SCANNER_DESIGN.md](SCANNER_DESIGN.md) §AI). A provider failure returns
`502 upstream_error`; recommendations are unaffected. Requires a BYO key
for the chosen provider (below), except `ollama`. Rate limited
(20 / hour / user).

## BYO API Keys

### `GET /api/v1/providers` 🔒 · `POST /api/v1/providers` 🔒 · `DELETE /api/v1/providers/:provider` 🔒

POST body: `{ "provider", "apiKey" }`. The key is accepted once over
HTTPS, AES-256-GCM encrypted immediately
([`worker/lib/crypto.ts`](../worker/lib/crypto.ts), key material from the
`ENCRYPTION_KEY` secret), and stored as ciphertext. **No endpoint ever
returns a key** — GET lists only `{ provider, addedAt }`. Decryption
happens transiently in Worker memory for a single upstream call and is
never logged.

## Settings

### `GET /api/v1/settings` 🔒 · `PUT /api/v1/settings` 🔒

`{ "preferredAiProvider", "preferredAiModel" }` — which provider/model
`analyze` should use by default.

## Export

### `GET /api/v1/export?reportId=&format=` 🔒

`format` = `json | markdown | html`. Returns the formatted report as a
file download. Uses the same pure formatters as the dashboard's
client-side export ([`src/utils/exportFormat.ts`](../src/utils/exportFormat.ts)).

## Non-goals

- The API never receives file contents — only the metadata allow-listed
  in [PRIVACY.md](../PRIVACY.md), enforced by the upload schema.
- The API never issues commands back to the scanner. Strictly
  scanner → API (submit) and dashboard → API (read); the scanner remains
  a one-shot CLI with no listening port.
- No endpoint executes a cleanup command. Cleanup commands are display
  strings the user reviews and runs themselves.
