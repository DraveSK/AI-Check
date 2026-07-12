import type { RouteContext } from '../router';
import { ok, pick } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission } from '../lib/rbac';
import { listDevices } from '../lib/db';

/** GET /api/v1/device — devices the signed-in user has scanned. Devices
 * are created implicitly by `POST /api/v1/report` (see report.ts), not
 * through a separate registration step — a device is just "something
 * that submitted a report," nothing more needs to be modeled. */
export async function listUserDevices(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'devices.read');
  if (user instanceof Response) return user;

  const devices = await listDevices(ctx.env.DB!, user.id);
  return ok(devices.map((d) => pick(d, ['id', 'name', 'platform', 'os_version', 'model', 'created_at'])));
}
