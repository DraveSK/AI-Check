import { useEffect, useRef, useState } from 'react';
import type { ProviderResult } from '../types';

/**
 * Calls a provider method on mount (and whenever `deps` change) and exposes
 * its `ProviderResult` envelope. Centralizes loading/error handling so
 * screens never touch `useState`/`useEffect` for data fetching directly.
 */
export function useProviderData<T>(
  fetcher: () => Promise<ProviderResult<T>>,
  deps: unknown[] = [],
): ProviderResult<T> {
  const [result, setResult] = useState<ProviderResult<T>>({
    status: 'loading',
    data: null,
    source: 'mock',
  });
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setResult((prev) => ({ ...prev, status: 'loading' }));
    fetcher()
      .then((next) => {
        if (requestId.current === currentRequest) setResult(next);
      })
      .catch((error: unknown) => {
        if (requestId.current === currentRequest) {
          setResult({
            status: 'error',
            data: null,
            source: 'mock',
            error: error instanceof Error ? error.message : 'Unknown provider error',
          });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}
