# Security Policy

AI Check inspects sensitive parts of a user's device (SSH keys, API keys,
crypto wallet presence, credential stores). Security is treated as a
first-class design constraint, not an afterthought — see
[PRIVACY.md](PRIVACY.md) for the data-collection allow-list this policy
assumes.

## Supported versions

AI Check is pre-1.0 (see [ROADMAP.md](ROADMAP.md)). Until v1.0, only the
`main` branch is supported with security fixes. There is no LTS branch yet.

| Version | Supported |
|---|---|
| `main` (pre-release) | ✅ |
| Tagged releases before v1.0 | ❌ (upgrade to `main`) |

## Reporting a vulnerability

**Do not open a public GitHub issue for a security vulnerability.**

Instead, use GitHub's private vulnerability reporting
(Security → Report a vulnerability on this repository), or email the
maintainers directly if that's unavailable. Include:

- A description of the vulnerability and its impact
- Steps to reproduce (a minimal repro is ideal)
- Affected component (dashboard / API / scanner spec implementation /
  provider) and version/commit

**Response targets** (best-effort until a formal security team exists):

- Acknowledgement: within 5 business days
- Initial assessment (confirmed / not applicable / needs more info): within
  10 business days
- Fix or mitigation timeline communicated once triaged

We will credit reporters in the release notes unless anonymity is
requested. Please give us a reasonable window to ship a fix before public
disclosure.

## Threat model

AI Check's threat model is scoped around the fact that the scanner touches
some of the most sensitive locations on a user's filesystem.

### Assets to protect

1. Secret material on the user's device (SSH private keys, API keys,
   `.env` files, crypto wallet files, credential store contents).
2. The integrity of the `InspectionReport` a user submits (it should
   reflect their real device, not be forgeable/tamperable in transit).
3. The user's trust that AI Check does only what it says it does.

### Threat actors considered

| Actor | Concern |
|---|---|
| Malicious/compromised dependency | Supply-chain attack that turns a metadata-only collector into a secret-exfiltration tool |
| Network attacker (MITM) | Tampering with or intercepting a report in transit to the API |
| Malicious/compromised API/cloud backend | A rogue or compromised hosted API attempting to over-collect via a modified request, or mishandling stored reports |
| Malicious fork | A derivative of the open-source scanner that silently reads file contents in violation of [PRIVACY.md](PRIVACY.md) |
| Local attacker with device access | Tampering with a locally-cached report before submission |

### Out of scope (for now)

- Protecting against a fully compromised OS/kernel (if the OS is
  compromised, no userland scanner can make guarantees).
- Physical security of the device.
- Nation-state-level targeted attacks. AI Check is a consumer/prosumer tool,
  not a hardened security product — this is stated plainly so users
  calibrate trust correctly.

### Mitigations

| Risk | Mitigation |
|---|---|
| Collector scope creep (reading secret contents) | Type-level allow-list: `src/types/index.ts` has no field capable of holding secret content (see [PRIVACY.md](PRIVACY.md)); schema validation on the API rejects unknown fields |
| Supply-chain compromise of scanner deps | Scanner ships as a pinned, minimal-dependency binary (see [Scanner Specification](docs/SCANNER_SPEC.md)); dependency review required on any PR touching `scanner/` once it exists |
| MITM in transit | HTTPS-only submission; Phase 2 adds request signing / report checksums |
| Rogue/compromised API | Open API contract ([API.md](docs/API.md)) so self-hosting is always possible instead of trusting a black box; principle of least data (API only ever receives what the schema allows) |
| Malicious forks misrepresenting themselves as AI Check | MIT license requires attribution; users are encouraged to build the scanner from source and verify checksums for release binaries (process to be published alongside first scanner release) |
| Cleanup script executing unintended deletions | Cleanup is plan-then-review-then-execute, never automatic (see [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md) §Cleanup script generation) — AI Check's own process never calls `exec()` on a generated script |

Note on scope: earlier drafts of this document specified a third-party
plugin system (manifest validation, sandboxing, permission enums, code
signing). That system is not being built — see
[docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md) §"What we're deliberately
not building yet." All collectors ship in this repository and go through
normal PR review instead of a runtime trust boundary. If a real plugin
system becomes necessary later, this document gets a corresponding
threat-model section again at that time, not before.

## Authentication & session security (implemented)

- **Magic link only — no passwords exist anywhere in the system.** There
  is nothing password-shaped to phish, stuff, or leak.
- Magic-link tokens: 32 random bytes, 15-minute expiry, single-use, and
  **only the SHA-256 hash is stored** (`magic_links.token_hash` in
  `d1/migrations/0001_init.sql`) — a leaked database row cannot be used
  to sign in.
- Sessions: same hash-only storage (`sessions.id = sha256(token)`),
  30-day expiry, delivered as an `HttpOnly; Secure; SameSite=Lax` cookie
  (`worker/lib/auth.ts`) — unreadable from JavaScript, HTTPS-only, not
  sent on cross-site requests. The scanner CLI uses the identical token
  as a `Bearer` header, stored locally in `~/.ai-check/session.json` with
  mode 0600.
- The magic-link request endpoint returns the same response whether or
  not the email is registered — no user enumeration — and is rate
  limited (5 requests / 15 min / IP).
- Logout deletes the session server-side, not just the cookie.
- Sign-in is blocked (not just limited) for accounts an admin has
  disabled — checked in `verifyMagicLink` before a session is ever
  created. Existing sessions issued before the disable aren't
  retroactively revoked — see [RBAC.md](docs/RBAC.md) §Non-goals for why
  this is documented debt, not an oversight.

## Authorization (RBAC, implemented)

Every API route checks a specific **permission**, not just "is there a
valid session" — see [docs/RBAC.md](docs/RBAC.md) for the full role/
permission matrix, route map, and ownership rules. Highlights relevant to
this document specifically:

- Role changes require `system.write` (`super_admin` only) — a plain
  `admin` cannot promote themselves or anyone else, closing the obvious
  privilege-escalation path a looser "admin manages users" rule would
  leave open.
- `GET /api/v1/system` (binding/secret *status*) is `super_admin`-only and
  never returns a secret's value — see §API key handling below for why
  that boundary exists at all, not just for this one endpoint.
- The frontend's nav filtering and 403 page (`src/components/Forbidden.tsx`)
  are a UI convenience only — every permission check is re-verified
  server-side regardless of what the client sends.

## API key handling (BYO AI keys, implemented)

- Keys are accepted once over HTTPS, encrypted immediately with
  AES-256-GCM (`worker/lib/crypto.ts`; key material from the
  `ENCRYPTION_KEY` Worker secret, never in the database), and stored as
  ciphertext + IV in D1.
- **No API endpoint ever returns a key** — `GET /api/v1/providers` lists
  only provider name and creation date (see `worker/routes/providers.ts`).
- Decryption happens transiently in Worker memory for a single upstream
  AI call and the plaintext is never logged, never persisted, never
  echoed in an error message.
- Known limitation: rotating `ENCRYPTION_KEY` orphans stored keys (users
  must re-enter them). Acceptable for the current scale; a re-encryption
  migration is future work.

## API-layer protections (implemented)

- Every request body is Zod-validated (`worker/lib/validation.ts`);
  uploads that fail `InspectionReport` validation are rejected outright,
  never partially stored.
- Rate limiting (KV fixed-window, `worker/lib/ratelimit.ts`): magic links
  5/15min/IP, uploads 30/hr/user, AI analysis 20/hr/user.
- Every report query is scoped `WHERE user_id = ?` in the SQL itself —
  cross-user access is structurally impossible, not just unlinked.
- Structured JSON logging with request IDs (`worker/lib/log.ts`);
  secrets, tokens, keys, and report contents are never logged, and the
  audit log (`audit_logs`) records actions, never payloads.
- Missing infrastructure degrades to `501 not_configured`
  (`worker/lib/guard.ts`) rather than an unhandled exception — the app
  never crashes on a missing binding.

## Future security audit checklist

To be run before v1.0 and before any GA claim of "production-ready":

- [ ] Independent review of every collector in the scanner against the
      [PRIVACY.md](PRIVACY.md) allow-list, per platform
- [ ] Static analysis / dependency audit (`npm audit`, `cargo audit`, or
      equivalent for whatever language the scanner ships in) with zero
      known-critical findings
- [ ] Fuzz testing of the API's `InspectionReport` schema validator
- [ ] Confirm no collector ever requests elevated/admin privileges
- [ ] Confirm the cleanup script generator never emits a command outside an
      explicitly reviewed allow-list of safe operations (no arbitrary `rm`
      construction from unsanitized paths)
- [ ] Third-party penetration test of the hosted API (before any paid tier
      GA — see [OPEN_CORE.md](docs/OPEN_CORE.md))
- [ ] Verify report submission is authenticated and rate-limited
- [ ] Confirm secrets (API keys for BYO-AI) are never logged server-side
- [ ] Reproducible-build verification for release scanner binaries
- [ ] Confirm a `red`-classified finding (e.g. a wallet or SSH key) cannot
      be recommended for deletion under any rule ordering — see
      [docs/SCANNER_DESIGN.md](docs/SCANNER_DESIGN.md) §Rules
- [ ] Confirm the AI explanation step cannot alter the recommendation list
      it was given — test with a deliberately adversarial AI response

## Known limitations today

- The scanner covers macOS Storage only; Security/Performance/Crypto
  collectors are specified but not implemented (see
  [ROADMAP.md](ROADMAP.md)) — the corresponding dashboard screens still
  show mock data even in production mode.
- No independent security audit or penetration test has been performed
  yet (see the checklist above — it gates v1.0, and this is pre-1.0).
- `ENCRYPTION_KEY` rotation orphans stored BYO keys (documented above).
- KV rate limiting is approximate (eventually consistent) — abuse
  mitigation, not a hard quota.
- Ollama as an AI provider only works when the API is self-hosted on a
  network that can reach the Ollama instance — a Cloudflare edge Worker
  cannot reach a user's localhost (documented in `worker/lib/ai/ollama.ts`).
