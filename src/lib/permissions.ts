/**
 * Frontend mirror of worker/lib/rbac.ts's `Permission` union — for typing
 * `useCloudAuth()`'s `permissions` array only. This is NOT where
 * authorization happens (see docs/RBAC.md "frontend checks are a UI
 * convenience, never a security boundary" — every API route enforces its
 * own permission independently via `requirePermission()`). If this type
 * and the backend's ever drift, the worst case is a nav item that's
 * shown-but-403s or hidden-but-would-have-worked — never a security hole,
 * because the server never trusts what the client claims to be able to do.
 */
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

export type Role = 'user' | 'admin' | 'super_admin';

export function can(permissions: Permission[], permission: Permission): boolean {
  return permissions.includes(permission);
}
