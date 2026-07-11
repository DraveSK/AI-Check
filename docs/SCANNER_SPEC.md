# AI Check — Scanner Specification (Design Only)

**Status: specification only. No scanner code exists yet.** This document
defines what Phase 2 must build. Nothing here should be implemented as part
of Phase 1.

## Goals

The scanner is a **local-only, read-mostly** CLI/agent that inspects a
single device, produces one `InspectionReport` JSON document (see
[`src/types/index.ts`](../src/types/index.ts) and [API.md](API.md)), and
submits it to an API endpoint the user configures — which may be Drave's
hosted API, a self-hosted instance, or nothing at all (dry-run/local-file
mode). The scanner **never**:

- listens on a network port,
- executes destructive actions without an explicit, itemized user
  confirmation step,
- reads file contents (only metadata: path, size, mtime, and for security
  checks, presence/permission bits — see [PRIVACY.md](../PRIVACY.md)).

## Module architecture

```
scanner/
  core/            # platform-agnostic orchestration, report assembly, schema validation
  platform/
    macos/         # macOS-specific collectors
    windows/        # Windows-specific collectors
    linux/          # Linux-specific collectors
  collectors/
    storage.ts       # interface implemented per-platform
    security.ts
    performance.ts
    developer-env.ts
    crypto.ts
  cleanup/          # safe-deletion planner + script generator (no execution)
  cli/              # argument parsing, output, submission to API
```

Each collector implements a shared interface, e.g.:

```ts
interface StorageCollector {
  collect(): Promise<StorageSnapshot>;
}
```

`core/` picks the right platform implementation at runtime and assembles the
final `InspectionReport`. This mirrors the dashboard's provider pattern
deliberately — the scanner is "providers, but for real hardware."

## Distribution

Ships as a single compiled binary per platform (no runtime dependency on
Node/Python being installed) — candidates: Rust, Go, or a bundled/pkg'd
Node binary. Decision deferred to Phase 2 (v0.4), tracked in
[ROADMAP.md](../ROADMAP.md). Whatever is chosen, the **output contract**
(the JSON) is fixed by this spec and by `src/types/index.ts`, so the
dashboard is unaffected by the choice.

## macOS

| Area | Signal source | Notes |
|---|---|---|
| Storage | `du`-equivalent via `NSFileManager` / `statfs`, `diskutil info` for volume capacity | No file contents read, only sizes |
| Security — SSH keys | Enumerate `~/.ssh/*` filenames, permission bits | Never read key contents |
| Security — API keys / `.env` | Filename + path pattern matching (`.env`, `*.pem`, `*_key`) in common project directories | Flag presence, not the file's value; "1 exposed" means found in a world-readable location, not that the secret was read |
| Security — Keychain | `security dump-keychain -d` **is explicitly out of scope** — Keychain items are enumerated by label only via `security find-generic-password -g` prompts, which is intrusive; Phase 2 must instead use `SecItemCopyMatching` with `kSecReturnAttributes` only (no `kSecReturnData`) | Attributes only, never secret data |
| Performance | `host_statistics`/`libtop` via `sysctl`, or `top -l 1` | CPU/memory aggregate percentages only |
| Developer environment | Presence checks: `xcode-select -p`, `brew list`, `node -v`, `docker info`, language version managers | Version + install size only |
| Crypto wallets | Known install paths/bundle IDs (e.g. `~/Library/Application Support/MetaMask` via browser profile, `~/Library/Application Support/Exodus`) | Presence only, never wallet files' contents |
| Required permissions | Full Disk Access (for `~/Library` paths under sandboxing), no elevated/root required for any read in this list |

## Windows

| Area | Signal source | Notes |
|---|---|---|
| Storage | `GetDiskFreeSpaceEx`, WMI `Win32_LogicalDisk`, directory size via `robocopy /L` or native `FindFirstFile` walk | |
| Security — SSH keys | `%USERPROFILE%\.ssh\*` enumeration | |
| Security — API keys / `.env` | Path/filename pattern matching in common project directories | |
| Security — Credential Manager | `CredEnumerate` for entry names/targets only, never `CredRead` secret blobs | Attributes only |
| Performance | WMI `Win32_Processor`, `Win32_OperatingSystem` for CPU/memory percentages | |
| Developer environment | Registry uninstall keys, `where` checks for `node`, `docker`, `python`, `git` | |
| Crypto wallets | Known install paths under `%APPDATA%`/`%LOCALAPPDATA%` and browser extension IDs | Presence only |
| Required permissions | Standard user; no admin/elevation required for any read in this list |

## Linux

| Area | Signal source | Notes |
|---|---|---|
| Storage | `statvfs`, `du`-equivalent walk respecting one filesystem (`-x`) | |
| Security — SSH keys | `~/.ssh/*` enumeration | |
| Security — API keys / `.env` | Path/filename pattern matching | |
| Security — Secret Service | `org.freedesktop.secrets` D-Bus API, attributes only (`get_secret` is out of scope) | Attributes only |
| Performance | `/proc/stat`, `/proc/meminfo` | |
| Developer environment | `$PATH` probing (`node`, `docker`, `python3`, `go`, `rustc`), package manager queries (`dpkg -l` / `rpm -qa`) read-only | |
| Crypto wallets | Known install paths under `~/.config`, `~/.local/share`, and browser extension IDs | Presence only |
| Required permissions | Standard user; no `sudo` required for any read in this list |

## Security boundaries (cross-platform)

1. **No secret values ever leave the device.** Every collector above returns
   presence/metadata, never content. This is enforced at the type level:
   `SecurityFinding`, `WalletFinding` in `src/types/index.ts` have no field
   capable of holding a secret value — there is no `value:` or `contents:`
   field in the schema by design.
2. **No network listener.** The scanner is a one-shot CLI invocation, not a
   daemon. It makes one outbound HTTPS call to submit its report (or writes
   to a local file in dry-run mode) and exits.
3. **No silent destructive action.** Cleanup is a two-step flow:
   `cleanup/` produces a *plan* (`CleanupSnapshot` + generated script text);
   nothing is deleted until the user reviews and explicitly runs the
   generated script themselves, outside the scanner's own process if they
   choose. See `POST /api/v1/cleanup/script` in [API.md](API.md).
4. **Least privilege.** Every collector above is designed to run as the
   logged-in standard user. Anywhere a platform would require elevation
   (root/admin) to get a more complete answer, the scanner instead reports
   what it could determine unprivileged and flags the gap — it never
   prompts for elevated credentials.
5. **Deterministic, reviewable output.** The report is plain JSON matching
   a published schema, so any user (or auditor) can read exactly what was
   collected before it's ever transmitted.

## Expected JSON output

The scanner's sole output is one `InspectionReport` (defined once, in
[`src/types/index.ts`](../src/types/index.ts), and reproduced in
[API.md](API.md)). There is intentionally no scanner-specific schema
document — the TypeScript type *is* the schema, shared by the dashboard,
the API, and (via a generated JSON Schema / OpenAPI export, Phase 2) the
scanner implementation regardless of the language it's written in.
