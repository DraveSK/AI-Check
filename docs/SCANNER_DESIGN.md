# Scanner Design (Collectors, Rules, Cleanup, AI)

Status: **specification only — no scanner code exists yet.** This is one
short, pragmatic document instead of eight separate specs, because a
solo founder maintaining this alone doesn't benefit from a plugin
marketplace, a sandboxed loader, or a declarative rule-file format before
a single real collector has shipped. Every abstraction below is deferred
until there's a concrete second case that needs it — see "What we're
deliberately not building yet."

If AI Check ever has multiple outside contributors shipping independent
collectors at the same time, revisit this document and split out a real
plugin boundary then. Until that's true, one codebase, one release
cadence, plain functions.

## Collectors

A collector is just a function: `(context) => Promise<Snapshot>`, one per
category (storage, security, performance, developer, crypto), matching the
snapshot types already in [`src/types/index.ts`](../src/types/index.ts).
They live in one `scanner/collectors/` directory, one file per category,
selected by platform with a plain `if (platform === 'macos')` — no plugin
manifest, no loader, no separate SDK package. See
[docs/SCANNER_SPEC.md](SCANNER_SPEC.md) for what each platform's collector
should read.

```ts
// scanner/collectors/storage.ts
export async function collectStorage(platform: Platform): Promise<StorageSnapshot> {
  // macOS: statfs + du-equivalent walk. Windows: GetDiskFreeSpaceEx + WMI.
  // Linux: statvfs. See docs/SCANNER_SPEC.md for the full per-OS table.
}
```

Adding a new category later means adding a new file and a new optional
field on `InspectionReport` (see [SCHEMA.md](../SCHEMA.md)) — that's the
entire extension mechanism. No interface to implement beyond "returns the
right shape."

## Signatures — a plain data map, not a database

"Recognizing Docker" is a lookup: known paths/bundle IDs/commands mapped to
a display name and a default risk level. This lives as one TypeScript
object, not a directory of versioned, checksummed JSON files:

```ts
// scanner/signatures.ts
export const KNOWN_TOOLS: Record<string, ToolSignature> = {
  docker: {
    displayName: 'Docker',
    macos: { paths: ['/Applications/Docker.app'], command: 'docker' },
    windows: { registryKey: 'HKLM\\SOFTWARE\\Docker Inc.\\Docker Desktop' },
    linux: { command: 'docker' },
    riskLevel: 'green',
  },
  metamask: {
    displayName: 'MetaMask',
    macos: { paths: ['~/Library/Application Support/Google/Chrome/*/Extensions/*/metamask'] },
    riskLevel: 'red', // wallet — see Rules below
  },
  // ...
};
```

Adding a tool is a one-entry PR. If this file grows past a few hundred
entries and starts needing independent versioning or non-developer
contributors, split it into JSON at that point — not before.

## Rules — plain functions over Findings, not a rule-file format

A "rule" is a function that looks at a `Finding` and returns a
`Recommendation | null`. No JSON rule format, no condition-type
vocabulary, no separate engine to invoke — just an array of functions
evaluated in order:

```ts
// scanner/rules.ts
type Rule = (finding: Finding) => Recommendation | null;

const rules: Rule[] = [
  (f) => f.category === 'crypto' && f.detected
    ? protect(f, 'Wallet detected — never recommended for deletion')
    : null,

  (f) => f.category === 'security' && f.signatureId === 'ssh-key'
    ? protect(f, 'SSH keys are always protected')
    : null,

  (f) => f.signatureId === 'docker-cache' && f.bytes > 20 * GB
    ? cleanup(f, { title: 'Clean up Docker build cache', riskLevel: 'green', command: 'docker builder prune -f' })
    : null,

  (f) => f.signatureId === 'xcode-derived-data' && f.bytes > 15 * GB
    ? cleanup(f, { title: 'Clear Xcode DerivedData', riskLevel: 'green', command: 'rm -rf ~/Library/Developer/Xcode/DerivedData/*' })
    : null,
];

export function evaluate(findings: Finding[]): Recommendation[] {
  return findings
    .map((f) => rules.map((rule) => rule(f)).find(Boolean))
    .filter((r): r is Recommendation => r != null);
}
```

**The one invariant worth keeping from the heavier design**: a `protect()`
result always wins over a `cleanup()` result for the same finding — put
protective rules first in the array and stop at the first match, and that
falls out for free. No conflict-resolution subsystem required.

Every recommendation still carries `riskLevel`, `reason`, and (when
applicable) `estimatedBytesRecovered` — the *shape* from Phase 2 was fine
and stays; what's cut is the machinery for authoring rules as external
data.

## Risk levels

Four values, unchanged from Phase 2 because a fixed vocabulary is cheap
and useful: `green` (safe), `yellow` (review), `orange` (sensitive, never
auto-cleanup), `red` (protected, never recommended for deletion, full
stop). This is just a union type, not a "risk classification model" — see
`RiskLevel` in [`src/types/index.ts`](../src/types/index.ts).

## Cleanup script generation

Given `Recommendation[]`, group by risk level and print. Green commands
are active lines; Yellow commands are commented out; Orange/Red never
appear (they have no `command` to begin with, because `protect()` never
sets one). One function, one template per platform (`sh` / `.ps1`) — see
[docs/SCANNER_SPEC.md](SCANNER_SPEC.md) for the security constraint that
still applies: **the script is generated for review, never executed by AI
Check itself.** That rule doesn't need a subsystem to enforce it — just
don't write the code that calls `exec()` on it.

## AI — explains, never decides

Unchanged principle, much smaller interface. One function:

```ts
async function explain(recommendations: Recommendation[], apiKey: string, provider: 'anthropic' | 'openai' | 'ollama' | string): Promise<string>
```

It takes the final `Recommendation[]` and returns prose. It cannot add,
remove, or change a recommendation — enforced simply by the fact that its
return type is `string`, not `Recommendation[]`. Supporting a new AI
vendor means adding one branch to whatever HTTP call this function makes;
it doesn't need a registered provider interface until there are enough
vendors that the branches get unwieldy (realistically: never, for a solo
founder — most users pick one provider and that's it).

If no API key is configured, skip the call and show the recommendations
with their own `reason` text, unchanged. That's "offline mode" — not a
separate mode to build, just the natural behavior of an optional function
call.

## What we're deliberately not building yet

- **No plugin loader, manifest, or sandbox.** All collectors ship in this
  repo, reviewed the normal way a PR is reviewed. Revisit only if/when
  third parties are actually shipping independent collectors.
- **No signature database as versioned/checksummed files.** A TypeScript
  object is fine until it needs contributors who don't want to touch code.
- **No declarative rule-file format or rule engine runtime.** Rules are
  functions; that's already declarative *enough* to review and test.
- **No enterprise architecture doc.** Multi-device/team features, if they
  ever happen, get designed when there's a paying customer asking for
  them — see [docs/OPEN_CORE.md](OPEN_CORE.md) for the intended
  open/closed split, which is still worth keeping in mind so a future
  hosted feature doesn't require ripping up the local-first core.
- **No automated update distribution** for signatures/rules — they ship in
  the scanner release. If stale signatures become a real problem, a
  simple version check is a much smaller fix than the catalog/checksum
  system Phase 2 sketched.

## Where this leaves Phase 2's other docs

`SCHEMA.md` stays as-is — versioning discipline for the one shared type is
cheap and prevents real breakage. `docs/API.md`, `docs/SCANNER_SPEC.md`,
and `docs/OPEN_CORE.md` stay. Everything else from the "platform" phase
(Plugin SDK, Rule Engine, Signature Database, Recommendation Engine,
Cleanup Generator, AI Integration, Enterprise Architecture, Automation) is
replaced by this single document.
