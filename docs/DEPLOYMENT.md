# Deployment Guide

AI Check deploys as a single Cloudflare Worker: it serves the built React
dashboard as static assets and handles `/api/v1/*` in the same process
(see [ARCHITECTURE.md](../ARCHITECTURE.md)). This document is the
complete, from-zero path to a live deployment.

## Prerequisites

- A Cloudflare account with Workers enabled
- The GitHub repository's Actions secrets already set (see
  [CI/CD](#cicd-github-actions) below): `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`
- Node 22 and `npm` locally if you want to deploy by hand instead of via
  CI

### API token permissions

There are two different jobs and they need two different scopes — using a
narrower token for the wrong job is the most common failure mode
(`wrangler` errors with a generic `Authentication error [code: 10000]`,
which doesn't say *which* permission is missing):

| Workflow | Needs | Cloudflare dashboard token template |
|---|---|---|
| `deploy.yml` (routine deploys) | Workers Scripts:Edit | "Edit Cloudflare Workers" |
| `provision-infra.yml` (one-time/rare) | the above **plus** D1:Edit, Workers R2 Storage:Edit, Workers KV Storage:Edit | **Create Custom Token** — add those four permissions explicitly |

If `deploy.yml` already works but `provision-infra.yml` fails on its
"Verify Cloudflare credentials" or "Create or find D1 database" step,
the token needs to be re-created with the broader custom scope above and
`CLOUDFLARE_API_TOKEN` updated in **Settings → Secrets and variables →
Actions**. The same token can be used for both workflows — there's no
need to keep two.

## One-time infrastructure setup

The site works with **zero infrastructure**: static dashboard + API
endpoints that return `501 not_configured` for anything needing D1/R2/KV
(see `worker/lib/guard.ts`). Provisioning unlocks the real backend.

### Automated (recommended)

1. In GitHub, go to **Actions → Provision Cloudflare Infrastructure → Run
   workflow**.
2. It creates the D1 database (`ai-check-db`), R2 bucket
   (`ai-check-reports`), and KV namespace (`ai-check-ratelimit`) if they
   don't already exist; applies the D1 migrations
   (`d1/migrations/0001_init.sql`); commits the resulting bindings into
   [`wrangler.toml`](../wrangler.toml); and triggers a deploy.
3. Re-running this workflow is safe — every step checks for an existing
   resource before creating one.

### Manual (equivalent commands)

```bash
npx wrangler d1 create ai-check-db
npx wrangler r2 bucket create ai-check-reports
npx wrangler kv namespace create ai-check-ratelimit
```

Copy the printed `database_id` / KV `id` into `wrangler.toml` following
the template comment already there, then:

```bash
npm run db:migrate:remote
```

## Secrets (always manual — never committed, never handled by CI)

```bash
# 32 random bytes, base64-encoded — encrypts BYO AI provider keys at rest.
# Generate with: openssl rand -base64 32
npx wrangler secret put ENCRYPTION_KEY

# Optional. Without it, magic-link sign-in emails are logged to the
# Worker's console instead of sent — fine for testing, not for real users.
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM      # e.g. "AI Check <login@check.drave.sk>"

# Optional — defaults to the request's own origin if unset.
npx wrangler secret put APP_URL         # e.g. https://check.drave.sk
```

Rotating `ENCRYPTION_KEY` invalidates every stored BYO API key (they can
no longer be decrypted) — users would need to re-enter them in Settings.
There is no key-rotation migration path today; this is a known limitation
(see the final report's "remaining technical debt").

## CI/CD (GitHub Actions)

| Workflow | Trigger | Does |
|---|---|---|
| `.github/workflows/ci.yml` | every PR, every push to `main` | `npm ci`, lint, typecheck (app + worker + scanner), build — never deploys |
| `.github/workflows/deploy.yml` | push to `main`, or manual | `npm run build && wrangler deploy` |
| `.github/workflows/provision-infra.yml` | manual only | one-time/idempotent D1+R2+KV setup (see above) |

Required repository secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — a token with the "Edit Cloudflare Workers"
  template permissions (also needs D1/R2/KV edit if you'll run the
  provisioning workflow)
- `CLOUDFLARE_ACCOUNT_ID` — found on any domain's Cloudflare dashboard
  overview page

## Manual deploy (no CI)

```bash
npm ci
npm run build
npx wrangler deploy
```

## Environments

Development, staging, and production are handled the way Cloudflare
Workers intends — via `wrangler.toml` `[env.<name>]` sections that
override bindings/vars, not via a custom config abstraction:

```toml
[env.staging]
vars = { APP_URL = "https://staging.check.drave.sk" }
# [[env.staging.d1_databases]] ... (a separate staging DB, once needed)

[env.production]
vars = { APP_URL = "https://check.drave.sk" }
```

Deploy a specific environment with `wrangler deploy --env staging`. Until
there's an actual second environment in active use, only the default
(production) environment is configured — adding a `staging` block with
its own D1/R2 resources is a real, if small, operational cost (a second
database to migrate, a second bucket to manage), so it's deferred until
someone is actually blocked without one, consistent with
[docs/SCANNER_DESIGN.md](SCANNER_DESIGN.md) "what we're deliberately not
building yet." Local development already covers most of what a staging
environment would: `npm run dev` against `mock` or `local-report` mode
needs no Cloudflare account at all.

## Custom domain (check.drave.sk)

1. Cloudflare dashboard → Workers & Pages → `drave-ai-check` → Settings →
   Domains & Routes → Add Custom Domain → `check.drave.sk`.
2. Set the `APP_URL` secret to match (`npx wrangler secret put APP_URL`)
   so magic-link emails point at the right host.

## Rollback

Cloudflare Workers keeps every deployed version.

```bash
npx wrangler deployments list
npx wrangler rollback [deployment-id]
```

D1 has no automated rollback for migrations — `d1/migrations/` is
additive-only by convention (see [SCHEMA.md](../SCHEMA.md) for the same
discipline applied to the report schema). A destructive migration should
never be needed for the table set in
`d1/migrations/0001_init.sql`; if one ever is, write it as a new
`0002_*.sql` file that's reviewed like any other schema change, not as an
edit to `0001_init.sql`.

## Verifying a deploy

```bash
curl -s https://check.drave.sk/api/v1/auth/me
# {"error":{"code":"unauthorized","message":"Sign in required."}}  — expected when signed out

curl -s https://check.drave.sk/robots.txt
```

If D1/R2/KV aren't provisioned yet, most `/api/v1/*` routes return
`{"error":{"code":"not_configured", ...}}` with HTTP 501 — this is
correct, not a bug (see `worker/lib/guard.ts`).

## End-to-end smoke test (after secrets + infra are live)

```bash
npm run login -- you@example.com     # request + confirm a magic link
npm run scan -- --upload              # scan this Mac and upload the report
```

Then open the deployed site with `VITE_PROVIDER_MODE=cloud-api` configured
at build time (see [README.md](../README.md)) — Overview and Storage
Analyzer should show the uploaded report.
