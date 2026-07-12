# Role-Based Access Control

Status: **implemented.** One dashboard, one set of screens, role-aware
navigation — see [ARCHITECTURE.md](../ARCHITECTURE.md). This document is
the permission matrix, the route map, and the reasoning behind each
design choice that isn't obvious from the code alone.

## Roles

Four roles, defined once in [`worker/lib/rbac.ts`](../worker/lib/rbac.ts):

| Role | Who | Stored as |
|---|---|---|
| `guest` | No session | Never a database row — the absence of a valid session cookie/token *is* guest |
| `user` | Everyone who signs in | `users.role = 'user'` (default) |
| `admin` | Trusted staff | `users.role = 'admin'` |
| `super_admin` | Whoever bootstraps the instance | `users.role = 'super_admin'` |

### Bootstrapping

The **first account ever created** on an instance becomes `super_admin`
automatically (see `findOrCreateUser` in
[`worker/lib/db.ts`](../worker/lib/db.ts)). Every account after that is a
plain `user`. This is the entire setup story — there's no separate
"create the first admin" step, no seed script, no environment variable
listing admin emails. For a solo founder standing up their own instance,
"whoever signs in first is in charge" is the simplest correct answer;
anyone else can be promoted later by that person from the Users page.

## Permissions

Thirteen permissions, grouped by resource, each a `"resource.action"`
string:

| Group | Permissions |
|---|---|
| Reports | `reports.read`, `reports.write` |
| Devices | `devices.read`, `devices.write` |
| History | `history.read`, `history.write` |
| Settings | `settings.read`, `settings.write` |
| Users | `users.read`, `users.write` |
| System | `system.read`, `system.write` |
| Analytics | `analytics.read` |

### Why permissions, not role names, gate pages and routes

Every route and every page checks `hasPermission(role, 'reports.read')`,
never `role === 'admin'`. Two reasons:

1. **One place to change what a role can do.** If `admin` should gain
   `system.read` someday, that's a one-line edit to
   `ADMIN_PERMISSIONS` in `worker/lib/rbac.ts` — no route or page
   anywhere needs to change, because none of them hardcoded "admin."
2. **Adding a role is additive, not a find-and-replace.** A future
   `billing_admin` role that can see `analytics.read` but nothing else
   just needs its own entry in `ROLE_PERMISSIONS` — every existing route
   already asks "does this role have this permission," so it automatically
   does the right thing for a role it has never heard of.

### Permission matrix

| Permission | user | admin | super_admin |
|---|:---:|:---:|:---:|
| `reports.read` (own) | ✅ | ✅ (all) | ✅ (all) |
| `reports.write` (own) | ✅ | ✅ | ✅ |
| `devices.read`/`write` (own) | ✅ | ✅ | ✅ |
| `history.read`/`write` (own) | ✅ | ✅ | ✅ |
| `settings.read`/`write` (own) | ✅ | ✅ | ✅ |
| `users.read` | — | ✅ | ✅ |
| `users.write` (enable/disable) | — | ✅ | ✅ |
| `analytics.read` | — | ✅ | ✅ |
| `system.read`/`write` | — | — | ✅ |

**`users.write` covers enable/disable only, not role changes.** Changing
someone's role requires `system.write` (super_admin only) — see
§Ownership rules below for why this is a deliberate exception to the
"admin can manage users" rule the original spec implied.

## Ownership rules

A `user` only ever sees **their own** devices, reports, and history — not
because pages check `role`, but because every query in
[`worker/lib/db.ts`](../worker/lib/db.ts) is scoped by `user_id` by
default. An `admin` or `super_admin` can widen that scope via `?userId=`
on report endpoints (see `resolveTargetUserId` in
[`worker/routes/report.ts`](../worker/routes/report.ts)) — the ownership
check (`canAccessOwnedResource` in `worker/lib/rbac.ts`) is: *you, or
someone with `admin`/`super_admin` role.* There is no per-resource ACL —
ownership is always "the user_id column," which is what "simple to
maintain" means in practice here.

**Why role changes need `system.write`, not `users.write`:** the original
brief lists "Admin: can manage users" and separately "Cannot access
Cloudflare secrets — only Super Admin may manage platform config." Letting
a plain `admin` promote *themselves* to `super_admin` would make that
second rule meaningless — an admin account is one role-change call away
from full platform access. So role changes specifically require
`system.write`, while the routine moderation action (disabling an abusive
account) only needs `users.write`. This is documented here because it's
not obvious from the permission name alone.

## Route map

🔒 = requires a session. Permission shown is what `requirePermission()`
checks in the route (see [`worker/lib/rbac.ts`](../worker/lib/rbac.ts)).

| Route | Permission | Notes |
|---|---|---|
| `POST /api/v1/auth/magic-link` | none | Rate limited, no enumeration |
| `GET /api/v1/auth/verify` | none | Blocks sign-in for `status: disabled` accounts |
| `POST /api/v1/auth/logout` 🔒 | none | |
| `GET /api/v1/auth/me` 🔒 | none | Returns `role`, `permissions[]`, profile |
| `GET /api/v1/device` 🔒 | `devices.read` | Own devices only |
| `POST /api/v1/report` 🔒 | `reports.write` | |
| `GET /api/v1/report/:id` 🔒 | `reports.read` | `?userId=` for admin+ |
| `GET /api/v1/report/history` 🔒 | `reports.read` | `?userId=` for admin+ |
| `GET /api/v1/report/compare` 🔒 | `reports.read` | `?userId=` for admin+ |
| `POST /api/v1/analyze` 🔒 | `reports.read` | |
| `GET`/`PUT /api/v1/settings` 🔒 | `settings.read`/`write` | Own settings only, no admin override — see §Non-goals |
| `GET`/`POST /api/v1/providers` 🔒 | `settings.read`/`write` | |
| `DELETE /api/v1/providers/:provider` 🔒 | `settings.write` | |
| `GET /api/v1/export` 🔒 | `reports.read` | |
| `GET /api/v1/users` 🔒 | `users.read` | admin+ |
| `GET /api/v1/users/:id` 🔒 | `users.read` | admin+ |
| `PUT /api/v1/users/:id/role` 🔒 | `system.write` | super_admin only — see above |
| `PUT /api/v1/users/:id/status` 🔒 | `users.write` | admin+; cannot target yourself |
| `GET /api/v1/analytics` 🔒 | `analytics.read` | admin+ |
| `GET /api/v1/audit-logs` 🔒 | `analytics.read` | admin+ (no dedicated `audit.read` permission — see §Non-goals) |
| `GET /api/v1/system` 🔒 | `system.read` | super_admin only; binding/secret *presence*, never values |

## Frontend route guards

The sidebar (`navForPermissions()` in
[`src/config/navigation.ts`](../src/config/navigation.ts)) only ever shows
a nav item the signed-in user's permissions unlock — an `admin` never
sees "Platform" as a clickable link. But the frontend is a UI convenience,
never a security boundary (every route above enforces its own permission
regardless of what the client sends) — so `App.tsx`'s `Dashboard` also
checks `PAGE_PERMISSION[page]` against the user's permissions before
rendering, and shows a **`Forbidden` component (403), not a redirect** —
see [`src/components/Forbidden.tsx`](../src/components/Forbidden.tsx).
Redirecting an already-signed-in, permission-lacking user back to sign-in
would just bounce them into a loop; a dead-end 403 view is correct.

## Navigation

The **base nav** (Overview, Storage Analyzer, ... History, Settings) is
unchanged from Phase 1 — see [ARCHITECTURE.md](../ARCHITECTURE.md) — every
`user` role permission covers exactly what those screens need. Admin/
super_admin items are **appended**, never replacing or reordering the
base set:

```
user:         [base nav]
admin:        [base nav] + Users, Analytics, Audit Logs
super_admin:  [base nav] + Users, Analytics, Audit Logs, Platform
```

### Why "Platform" is one page, not eight

The original brief lists eight super-admin nav items: Platform,
Cloudflare, AI Providers, Database, Workers, Deployment, Secrets, System
Health. None of those should be *editable* through AI Check's own UI —
see [SECURITY.md](../SECURITY.md) §API key handling for why
`ENCRYPTION_KEY` specifically can never have an in-app editor (it's the
key that encrypts everything else; exposing an editor for it inside the
app it protects defeats the purpose). Once you accept that constraint,
seven of those eight items reduce to "a link to the Cloudflare dashboard"
— so they're sections on one `Platform` page
([`src/pages/Platform.tsx`](../src/pages/Platform.tsx)) instead of eight
near-empty pages. This is the KISS reading of the brief's own instruction
not to duplicate the Cloudflare dashboard's job, not a shortcut.

## Database

One migration on top of the existing schema
([`d1/migrations/0002_rbac.sql`](../d1/migrations/0002_rbac.sql)): adds
`display_name`, `avatar`, `role`, `status`, `updated_at`, `last_login` to
`users`. No new tables — see the migration file's own comment for why
roles are a column, not a `roles`/`user_roles` table pair (there are
exactly four, fixed in code, not user-editable).

## Audit logging

Every sensitive action already funnels through the same `recordAudit()`
(`worker/lib/db.ts`, table from Phase 4) — this phase added `auth.sign_in`
/`sign_in_blocked`/`sign_out`, `user.role_changed`, `user.status_changed`,
`settings.updated`. **Never logged**: passwords (none exist in the
system), API key values, session tokens, report contents — every
`recordAudit()` call site passes only IDs and non-secret metadata, by
convention enforced at code review, not by a filter (there's nothing to
filter if the secret is never in the call in the first place).

## Non-goals (documented, not silently skipped)

- **No per-report ACL / sharing.** Ownership is `user_id`, full stop — no
  "share this report with user X" feature. Add it only if someone
  actually asks; it's a real feature with real edge cases (revocation,
  read vs. write shares), not a checkbox.
- **No admin override for `/api/v1/settings` or `/api/v1/providers`.** An
  admin cannot view or change another user's AI provider keys — those
  stay strictly self-service, both because there's no product need for an
  admin to manage someone else's BYO key, and because it would mean an
  admin could exfiltrate a user's key indirectly (trigger `/api/v1/analyze`
  on their behalf). Reports/devices/history admin-override exists because
  "admin can see what's happening on a user's device" is a real support
  need; "admin can use a user's OpenAI key" is not.
- **No dedicated `audit.read` permission.** Audit logs and analytics are
  both "admin-level platform visibility, read-only" — reusing
  `analytics.read` for both avoided a permission whose only purpose was
  gating one route.
- **No immediate session revocation on disable.** Disabling a user blocks
  *future* sign-ins (checked in `verifyMagicLink`) but doesn't invalidate
  sessions already issued — those expire naturally (30 days, see
  [`worker/lib/auth.ts`](../worker/lib/auth.ts)). A `DELETE FROM sessions
  WHERE user_id = ?` on disable would close this gap; deferred because
  disabling someone whose access needs to be cut *immediately* (compromised
  account, not routine moderation) is a different, higher-urgency
  operation than this phase's "disable an abusive account" scope. Tracked
  as technical debt below.

## Remaining technical debt

- Immediate session revocation on account disable/role downgrade (see
  above).
- Rate limiting is per-IP/per-user, not per-role — a compromised `admin`
  account has the same request budget as a `user`. Not a problem yet at
  this scale.
- No UI for a `super_admin` to see *why* the first-user bootstrap assigned
  a given account that role (it's implicit from `users.created_at` being
  earliest) — fine for a solo founder, would need a note if this instance
  ever has a real onboarding flow.

## Phase 5 candidates

- Per-report sharing (only if requested — see §Non-goals)
- Immediate session revocation
- Email verification step before first sign-in (currently: whoever
  controls the inbox is the account, which is the entire point of magic
  links, but there's no separate "verify this is really your email before
  you're `super_admin`" step for the bootstrap account specifically)
- A `billing_admin` or similar narrower role, once there's a billing
  feature to gate
