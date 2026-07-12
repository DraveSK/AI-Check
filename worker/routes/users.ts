import type { RouteContext } from '../router';
import { apiError, ok, pick } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission } from '../lib/rbac';
import { listUsers, getUserById, updateUserRole, updateUserStatus, recordAudit, listDevices, listReports } from '../lib/db';
import { z } from 'zod';
import { safeParseJSON } from '../lib/validation';

const USER_LIST_FIELDS = ['id', 'email', 'display_name', 'avatar', 'role', 'status', 'created_at', 'last_login'] as const;

const roleUpdateSchema = z.object({ role: z.enum(['user', 'admin', 'super_admin']) });
const statusUpdateSchema = z.object({ status: z.enum(['active', 'disabled']) });

/** GET /api/v1/users?search= — admin+. See docs/RBAC.md §User management. */
export async function listUsersRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'users.read');
  if (user instanceof Response) return user;

  const search = new URL(ctx.request.url).searchParams.get('search') ?? undefined;
  const users = await listUsers(ctx.env.DB!, search);
  return ok(users.map((u) => pick(u, USER_LIST_FIELDS)));
}

/** GET /api/v1/users/:id — profile + their devices/reports (counts only,
 * not the report contents — an admin browsing the Users page doesn't
 * need to see someone's storage breakdown, just that they've scanned). */
export async function getUserRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const requester = await requirePermission(ctx.request, ctx.env, 'users.read');
  if (requester instanceof Response) return requester;

  const target = await getUserById(ctx.env.DB!, ctx.params.id);
  if (!target) return apiError('not_found', 'User not found.');

  const [devices, reports] = await Promise.all([
    listDevices(ctx.env.DB!, target.id),
    listReports(ctx.env.DB!, target.id, undefined, 10),
  ]);

  return ok({
    ...pick(target, USER_LIST_FIELDS),
    deviceCount: devices.length,
    devices: devices.map((d) => pick(d, ['id', 'name', 'platform', 'created_at'])),
    recentReportCount: reports.length,
  });
}

/** PUT /api/v1/users/:id/role — super_admin only. A plain `admin` can see
 * every user but cannot promote/demote anyone, including themselves —
 * only whoever holds `system.write` can change roles. See
 * docs/RBAC.md §Ownership rules ("Cannot access Cloudflare secrets" is
 * one instance of a broader rule: role changes are as sensitive as
 * platform config, not a routine admin action). */
export async function updateUserRoleRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const requester = await requirePermission(ctx.request, ctx.env, 'system.write');
  if (requester instanceof Response) return requester;

  const body = await ctx.request.json().catch(() => null);
  const parsed = safeParseJSON(roleUpdateSchema, body);
  if (!parsed.success) return apiError('invalid_request', 'role must be user, admin, or super_admin.', parsed.errors);

  const target = await getUserById(ctx.env.DB!, ctx.params.id);
  if (!target) return apiError('not_found', 'User not found.');

  await updateUserRole(ctx.env.DB!, target.id, parsed.data.role);
  await recordAudit(ctx.env.DB!, requester.id, 'user.role_changed', { targetUserId: target.id, fromRole: target.role, toRole: parsed.data.role });

  return ok({ id: target.id, role: parsed.data.role });
}

/** PUT /api/v1/users/:id/status — admin+ (disabling abusive accounts is a
 * routine moderation action, unlike changing someone's role). A disabled
 * user's existing sessions still work until they expire naturally or the
 * user attempts to sign in again (see worker/routes/auth.ts
 * verifyMagicLink, which blocks new sign-ins for disabled accounts) —
 * immediate session revocation isn't implemented; see remaining
 * technical debt in docs/RBAC.md. */
export async function updateUserStatusRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const requester = await requirePermission(ctx.request, ctx.env, 'users.write');
  if (requester instanceof Response) return requester;

  const body = await ctx.request.json().catch(() => null);
  const parsed = safeParseJSON(statusUpdateSchema, body);
  if (!parsed.success) return apiError('invalid_request', 'status must be active or disabled.', parsed.errors);

  const target = await getUserById(ctx.env.DB!, ctx.params.id);
  if (!target) return apiError('not_found', 'User not found.');
  if (target.id === requester.id) return apiError('invalid_request', 'You cannot change your own account status.');

  await updateUserStatus(ctx.env.DB!, target.id, parsed.data.status);
  await recordAudit(ctx.env.DB!, requester.id, 'user.status_changed', { targetUserId: target.id, status: parsed.data.status });

  return ok({ id: target.id, status: parsed.data.status });
}
