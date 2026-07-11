import { useEffect, useState } from 'react';

export interface CloudAuthState {
  status: 'checking' | 'signed-in' | 'signed-out';
  email: string | null;
}

/**
 * Auth is app-shell infrastructure, not a data domain — it deliberately
 * doesn't go through the provider registry (see src/providers/types.ts).
 * Only relevant when VITE_PROVIDER_MODE=cloud-api; local-report and mock
 * modes never call this.
 */
export function useCloudAuth(): CloudAuthState {
  const [state, setState] = useState<CloudAuthState>({ status: 'checking', email: null });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setState({ status: 'signed-out', email: null });
        const body = (await res.json()) as { data: { email: string } };
        setState({ status: 'signed-in', email: body.data.email });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'signed-out', email: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
