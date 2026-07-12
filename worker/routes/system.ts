import type { RouteContext } from '../router';
import { ok } from '../lib/http';
import { requirePermission } from '../lib/rbac';

/**
 * GET /api/v1/system — super_admin only. Reports whether each Cloudflare
 * binding/secret is configured, never their values — see
 * docs/SECURITY.md §API key handling for why secret *values* are never
 * exposed through any endpoint, including this one. This backs the
 * Platform page's "System Health" section; actually managing D1/R2/KV/
 * secrets still happens in the Cloudflare dashboard (see
 * docs/DEPLOYMENT.md) — this route is read-only status, not a config UI.
 */
export async function getSystemStatus(ctx: RouteContext): Promise<Response> {
  const user = await requirePermission(ctx.request, ctx.env, 'system.read');
  if (user instanceof Response) return user;

  return ok({
    bindings: {
      DB: ctx.env.DB != null,
      REPORTS: ctx.env.REPORTS != null,
      RATE_LIMIT: ctx.env.RATE_LIMIT != null,
    },
    secrets: {
      ENCRYPTION_KEY: ctx.env.ENCRYPTION_KEY != null,
      BREVO_API_KEY: ctx.env.BREVO_API_KEY != null,
      EMAIL_FROM: ctx.env.EMAIL_FROM != null,
      APP_URL: ctx.env.APP_URL != null,
    },
  });
}
