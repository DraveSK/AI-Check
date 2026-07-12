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
}

export interface CloudAuthState {
  status: 'checking' | 'signed-in' | 'signed-out';
  user: CloudUser | null;
}

/**
 * Auth (and the role/permissions that ride along with it) is app-shell
 * infrastructure, not a data domain — it deliberately doesn't go through
 * the provider registry (see src/providers/types.ts). Only relevant when
 * VITE_PROVIDER_MODE=cloud-api; local-report and mock modes never call
 * this and everyone there is implicitly a full-access single user.
 */
export function useCloudAuth(): CloudAuthState {
  const [state, setState] = useState<CloudAuthState>({ status: 'checking', user: null });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setState({ status: 'signed-out', user: null });
        const body = (await res.json()) as { data: CloudUser };
        setState({ status: 'signed-in', user: body.data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'signed-out', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
