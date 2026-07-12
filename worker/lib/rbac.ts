import type { Env } from '../env';
import type { UserRow } from './db';
import { apiError } from './http';
import { requireUser } from './auth';

/**
 * Centralized authorization. Every route imports from here instead of
 * checking `user.role === 'admin'` inline — see docs/RBAC.md "why pages
 * check permissions, not role names." This is the one file that changes
 * if a permission's meaning changes or a role gains/loses one.
 */

export type Role = 'guest' | 'user' | 'admin' | 'super_admin';

export type Permission =
  | 'reports.read'
  | 'reports.write'
  | 'devices.read'
  | 'devices.write'
  | 'history.read'
  | 'history.write'
  | 'settings.read'
  | 'settings.write'
  | 'users.read'
  | 'users.write'
  | 'system.read'
  | 'system.write'
  | 'analytics.read';

const USER_PERMISSIONS: Permission[] = [
  'reports.read',
  'reports.write',
  'devices.read',
  'devices.write',
  'history.read',
  'history.write',
  'settings.read',
  'settings.write',
];

const ADMIN_PERMISSIONS: Permission[] = [...USER_PERMISSIONS, 'users.read', 'users.write', 'analytics.read'];

const SUPER_ADMIN_PERMISSIONS: Permission[] = [...ADMIN_PERMISSIONS, 'system.read', 'system.write'];

/** guest (no session) has no permissions — every route that matters
 * already requires a session first (see requireUser); this map exists so
 * `hasPermission('guest', ...)` is a defined, always-false answer rather
 * than a special case callers need to remember. */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  guest: new Set(),
  user: new Set(USER_PERMISSIONS),
  admin: new Set(ADMIN_PERMISSIONS),
  super_admin: new Set(SUPER_ADMIN_PERMISSIONS),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsForRole(role: Role): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role]);
}

/** `admin` and `super_admin` see every user's data; a plain `user` only
 * ever sees their own — see docs/RBAC.md §Ownership rules. This is the
 * one function every route uses to decide "can this request see this
 * resource," instead of re-deriving the rule per route. */
export function canAccessOwnedResource(user: Pick<UserRow, 'id' | 'role'>, resourceOwnerId: string): boolean {
  if (user.id === resourceOwnerId) return true;
  return user.role === 'admin' || user.role === 'super_admin';
}

/** Route-level helper: resolves the signed-in user and checks a
 * permission in one call. Returns the user on success, or a ready-to-
 * return 401/403 Response — see the
 * `const user = await requirePermission(...); if (user instanceof Response) return user;`
 * pattern used throughout worker/routes/*.ts. */
export async function requirePermission(request: Request, env: Env, permission: Permission): Promise<UserRow | Response> {
  const user = await requireUser(request, env);
  if (user instanceof Response) return user;
  if (user.status === 'disabled') return apiError('forbidden', 'This account has been disabled.');
  if (!hasPermission(user.role as Role, permission)) {
    return apiError('forbidden', `Missing permission: ${permission}.`);
  }
  return user;
}
