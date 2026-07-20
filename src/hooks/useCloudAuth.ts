import { useEffect, useState } from 'react';
import type { Permission, Role } from '../lib/permissions';

export interface CloudUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  role: Role;
  status: string;
  last_login: string | null;
  permissions: Permission[];
  isGuest: boolean;
}

export interface CloudAuthState {
  status: 'checking' | 'signed-in' | 'signed-out';
  user: CloudUser | null;
}

async function fetchMe(): Promise<CloudUser | null> {
  const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  const body = (await res.json()) as { data: CloudUser };
  return body.data;
}

/**
 * Auth (and the role/permissions that ride along with it) is app-shell
 * infrastructure, not a data domain — it deliberately doesn't go through
 * the provider registry (see src/providers/types.ts). Only relevant when
 * VITE_PROVIDER_MODE=cloud-api; local-report and mock modes never call
 * this and everyone there is implicitly a full-access single user.
 *
 * A brand-new visitor with no session is silently given a guest account
 * (POST /api/v1/auth/guest — see docs/RBAC.md §Guest accounts) instead
 * of being sent to the Login page. They can scan and see real results
 * immediately; `user.isGuest` tells the UI to offer "save your results"
 * rather than a full account-required gate.
 */
export function useCloudAuth(): CloudAuthState {
  const [state, setState] = useState<CloudAuthState>({ status: 'checking', user: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let user = await fetchMe();
      if (!user) {
        const created = await fetch('/api/v1/auth/guest', { method: 'POST', credentials: 'include' }).catch(() => null);
        if (created?.ok) user = await fetchMe();
      }
      if (cancelled) return;
      setState(user ? { status: 'signed-in', user } : { status: 'signed-out', user: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
