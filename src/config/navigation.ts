import {
  Activity,
  Bot,
  ClipboardList,
  Clock3,
  Code2,
  Gauge,
  HardDrive,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users as UsersIcon,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '../lib/permissions';

export type Page =
  | 'Overview'
  | 'Storage Analyzer'
  | 'Security Analyzer'
  | 'Performance Analyzer'
  | 'Developer Environment'
  | 'Crypto Wallet Detector'
  | 'Cleanup Recommendation'
  | 'AI Report'
  | 'Health Score'
  | 'Settings'
  | 'History'
  | 'Users'
  | 'Analytics'
  | 'Audit Logs'
  | 'Platform';

/** The screens every signed-in user sees, unchanged from Phase 1 — see
 * ARCHITECTURE.md. Nothing here is permission-gated because every plain
 * `user` role has every permission these screens need (see
 * worker/lib/rbac.ts USER_PERMISSIONS). */
export const nav: { name: Page; icon: LucideIcon }[] = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Storage Analyzer', icon: HardDrive },
  { name: 'Security Analyzer', icon: ShieldCheck },
  { name: 'Performance Analyzer', icon: Gauge },
  { name: 'Developer Environment', icon: Code2 },
  { name: 'Crypto Wallet Detector', icon: Wallet },
  { name: 'Cleanup Recommendation', icon: Sparkles },
  { name: 'AI Report', icon: Bot },
  { name: 'Health Score', icon: Activity },
  { name: 'History', icon: Clock3 },
];

/** Appended to `nav` only for roles that hold the matching permission —
 * see docs/RBAC.md §Navigation. Additive: the base `nav` array above
 * never changes shape, so this is never a redesign of the existing
 * screens, only extra items tacked on for admin/super_admin. */
export const ADMIN_NAV: { name: Page; icon: LucideIcon; permission: Permission }[] = [
  { name: 'Users', icon: UsersIcon, permission: 'users.read' },
  { name: 'Analytics', icon: ClipboardList, permission: 'analytics.read' },
  { name: 'Audit Logs', icon: ClipboardList, permission: 'analytics.read' },
  { name: 'Platform', icon: Wrench, permission: 'system.read' },
];

/** `permissions === null` means "not in cloud-api mode" (mock/local-
 * report) — there is no multi-user concept there, so the full base nav
 * applies with no admin items, same as always. In cloud-api mode, every
 * item the signed-in user's permissions unlock gets appended. */
export function navForPermissions(permissions: Permission[] | null): { name: Page; icon: LucideIcon }[] {
  if (permissions === null) return nav;
  const admin = ADMIN_NAV.filter((item) => permissions.includes(item.permission));
  return [...nav, ...admin];
}

/** Maps a Page to the permission required to view it. Pages absent here
 * (the base `nav` screens) require no permission beyond being signed in
 * — see docs/RBAC.md §Route guards. */
export const PAGE_PERMISSION: Partial<Record<Page, Permission>> = {
  Users: 'users.read',
  Analytics: 'analytics.read',
  'Audit Logs': 'analytics.read',
  Platform: 'system.read',
};
