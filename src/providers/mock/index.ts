import type { ProviderResult } from '../../types';
import type { ProviderRegistry } from '../types';
import {
  mockAIReport,
  mockCleanup,
  mockCrypto,
  mockDevice,
  mockDeveloperEnvironment,
  mockHealth,
  mockHistory,
  mockPerformance,
  mockSecurity,
  mockStorage,
} from './data';

/** Wraps a fixture in the standard provider envelope, simulating network
 * latency so loading states can be exercised during development. */
function ready<T>(data: T, delayMs = 220): Promise<ProviderResult<T>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ status: 'ready', data, source: 'mock', generatedAt: new Date().toISOString() });
    }, delayMs);
  });
}

/**
 * In-memory mock provider registry.
 *
 * This is the default registry used in local development and in the
 * open-source build until a `local-scanner` or `cloud-api` registry is
 * wired up (see `src/providers/index.tsx`).
 */
export const mockProviders: ProviderRegistry = {
  device: {
    getActiveDevice: () => ready(mockDevice),
  },
  health: {
    getHealthSnapshot: () => ready(mockHealth),
  },
  storage: {
    getStorageSnapshot: () => ready(mockStorage),
  },
  security: {
    getSecuritySnapshot: () => ready(mockSecurity),
  },
  performance: {
    getPerformanceSnapshot: () => ready(mockPerformance),
  },
  developerEnvironment: {
    getDeveloperEnvironmentSnapshot: () => ready(mockDeveloperEnvironment),
  },
  crypto: {
    getCryptoSnapshot: () => ready(mockCrypto),
  },
  cleanup: {
    getCleanupSnapshot: () => ready(mockCleanup),
  },
  aiReport: {
    getAIReport: () => ready(mockAIReport),
  },
  history: {
    getHistory: () => ready(mockHistory),
  },
};
