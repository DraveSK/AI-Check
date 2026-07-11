# Contributing to AI Check

Thanks for considering a contribution. AI Check is early — right now it's a
dashboard, a provider architecture, and a set of specs for the scanner and
API (see [ROADMAP.md](ROADMAP.md)) — which means there's a lot of
well-scoped, greenfield work available.

## Before you start

Read these first — they're short and they constrain every design decision
in this repo:

- [ARCHITECTURE.md](ARCHITECTURE.md) — the provider-layer pattern every
  screen and every future scanner/API implementation must follow
- [PRIVACY.md](PRIVACY.md) — the hard allow-list of what AI Check may ever
  collect; any PR that violates this will be closed
- [docs/OPEN_CORE.md](docs/OPEN_CORE.md) — what belongs in this repo vs. a
  closed-source counterpart

## Development setup

```bash
git clone https://github.com/<org>/ai-check.git
cd ai-check
npm install
npm run dev       # Vite dev server, mock providers by default
npm run build     # tsc -b && vite build
npm run preview   # preview the production build
```

No backend, database, or native toolchain is required to work on the
dashboard — everything runs against `src/providers/mock`.

## Where to contribute

| Area | Start here |
|---|---|
| Dashboard UI/UX | `src/pages`, `src/components` — must consume data only via `useProviders()`, never hardcode values (see below) |
| Provider interfaces | `src/providers/types.ts` — propose new interfaces here before implementing a feature that needs new data shapes |
| Scanner (Phase 2) | `docs/SCANNER_SPEC.md` — implementation not started; read the spec, propose the platform/language choice in an issue before writing code |
| API (Phase 2) | `docs/API.md` + `functions/api`, `src/worker.ts` |
| Documentation | Anything in the repo root or `docs/` |

## The one rule that matters most

**Never hardcode a domain value in a screen.** If you're building a UI that
needs a number, a status, or a list, it must come from a provider
(`useProviders()` / `useProviderData()`), even if that provider is
currently backed by mock data. This is what keeps the dashboard swappable
onto a real scanner without a rewrite — see
[ARCHITECTURE.md](ARCHITECTURE.md) for why.

If the data you need doesn't have a provider yet, add a method to the
relevant interface in `src/providers/types.ts`, implement it in
`src/providers/mock`, *then* build the screen against it.

## Commit / PR conventions

- Keep PRs focused — one logical change per PR.
- Reference the roadmap milestone your change belongs to when relevant
  (see [ROADMAP.md](ROADMAP.md)).
- Run `npm run build` before opening a PR — it runs `tsc -b`, so type
  errors are caught locally.
- Use the PR template; fill in the testing section honestly (screenshots
  for UI changes).

## Proposing larger changes

For anything that changes a provider interface, the API contract, or the
scanner spec, open a GitHub Discussion or issue first (see
[Discussions](#github-discussions) below) so the shape is agreed before
code is written — these are the seams the rest of the project depends on.

## GitHub Discussions

Use Discussions for:

- Proposing new provider interfaces or API endpoints
- Design debates on scanner platform/language choice (v0.4)
- General "how would I build X" questions

Use Issues for:

- Concrete bugs
- Well-scoped feature requests
- Documentation gaps

## Code of Conduct

Participation in this project is governed by our
[Code of Conduct](CODE_OF_CONDUCT.md).
