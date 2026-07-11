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

The current codebase is UI, architecture, and specifications only — there
is still no scanner and no real API implementation, so most of the risks
above are *designed against*, not yet *realized or verified*. This section
will be updated as each component ships. See [ROADMAP.md](ROADMAP.md) for
what's built vs. planned.
