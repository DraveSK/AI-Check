import type { RouteContext } from '../router';
import { ok } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission } from '../lib/rbac';
import { getPlatformStats } from '../lib/db';

/** GET /api/v1/analytics — admin+. Platform-wide counts only (see
 * worker/lib/db.ts getPlatformStats) — never per-user report contents. */
export async function getAnalytics(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'analytics.read');
  if (user instanceof Response) return user;

  const stats = await getPlatformStats(ctx.env.DB!);
  return ok(stats);
}
