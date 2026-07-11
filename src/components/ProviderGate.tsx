import type { ReactNode } from 'react';
import type { ProviderResult } from '../types';
import { EmptyState, ErrorState, LoadingState } from './ui';

/** Renders the correct state block for a `ProviderResult`, or the child
 * render-prop once data is ready. Keeps every screen's loading/empty/error
 * handling identical. */
export function ProviderGate<T>({
  result,
  emptyLabel,
  children,
}: {
  result: ProviderResult<T>;
  emptyLabel?: string;
  children: (data: T) => ReactNode;
}) {
  if (result.status === 'loading' || result.status === 'idle') return <LoadingState />;
  if (result.status === 'error') return <ErrorState label={result.error ?? 'Something went wrong.'} />;
  if (result.status === 'empty' || !result.data) return <EmptyState label={emptyLabel} />;
  return <>{children(result.data)}</>;
}
