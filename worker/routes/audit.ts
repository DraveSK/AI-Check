import type { RouteContext } from '../router';
import { ok } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission } from '../lib/rbac';
import { listAuditLogs } from '../lib/db';

/** GET /api/v1/audit-logs — admin+. `metadata` on each row is already
 * guaranteed secret-free at write time (see worker/lib/db.ts
 * recordAudit's callers) — this route does no additional filtering
 * because there's deliberately nothing to filter. See docs/SECURITY.md
 * §Logging. */
export async function getAuditLogs(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'analytics.read');
  if (user instanceof Response) return user;

  const logs = await listAuditLogs(ctx.env.DB!);
  return ok(logs);
}
