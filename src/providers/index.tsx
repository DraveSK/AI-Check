import { createContext, useContext, type ReactNode } from 'react';
import type { ProviderRegistry } from './types';
import { mockProviders } from './mock';
import { localReportProviders } from './local-report';
import { cloudApiProviders } from './cloud-api';

export type { ProviderRegistry } from './types';
export * from './types';

/**
 * Selects the active provider registry.
 *
 * `local-report` reads the JSON file written by `npm run scan` (see
 * scanner/cli.ts) — real storage/cleanup/device data, mock for everything
 * not scanned yet. `cloud-api` talks to the hosted Worker API instead
 * (see docs/API.md) — same shapes, same screens, no code change beyond
 * this switch.
 */
function resolveProviderRegistry(): ProviderRegistry {
  const mode = import.meta.env.VITE_PROVIDER_MODE ?? 'mock';
  switch (mode) {
    case 'cloud-api':
      return cloudApiProviders;
    case 'local-report':
      return localReportProviders;
    case 'mock':
    default:
      return mockProviders;
  }
}

const ProviderContext = createContext<ProviderRegistry | null>(null);

export function ProviderRoot({ children }: { children: ReactNode }) {
  const registry = resolveProviderRegistry();
  return <ProviderContext.Provider value={registry}>{children}</ProviderContext.Provider>;
}

export function useProviders(): ProviderRegistry {
  const registry = useContext(ProviderContext);
  if (!registry) {
    throw new Error('useProviders() called outside <ProviderRoot>.');
  }
  return registry;
}
