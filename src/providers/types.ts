import type {
  AIReportSnapshot,
  CleanupSnapshot,
  ComparisonResult,
  CryptoSnapshot,
  DeveloperEnvironmentSnapshot,
  DeviceInfo,
  HealthSnapshot,
  HistoryEntry,
  PerformanceSnapshot,
  ProviderResult,
  SecuritySnapshot,
  StorageSnapshot,
} from '../types';

/**
 * Provider contracts.
 *
 * A "provider" is the only way a screen is allowed to obtain domain data.
 * Screens never hardcode numbers and never fetch directly. This lets us
 * swap `mock` providers for `local-scanner` or `cloud-api` providers later
 * without touching a single UI component.
 *
 * All methods are async and return a `ProviderResult<T>` envelope so the
 * UI can render loading / empty / error states consistently.
 */

export interface DeviceProvider {
  getActiveDevice(): Promise<ProviderResult<DeviceInfo>>;
}

export interface HealthProvider {
  getHealthSnapshot(deviceId: string): Promise<ProviderResult<HealthSnapshot>>;
}

export interface StorageProvider {
  getStorageSnapshot(deviceId: string): Promise<ProviderResult<StorageSnapshot>>;
}

export interface SecurityProvider {
  getSecuritySnapshot(deviceId: string): Promise<ProviderResult<SecuritySnapshot>>;
}

export interface PerformanceProvider {
  getPerformanceSnapshot(deviceId: string): Promise<ProviderResult<PerformanceSnapshot>>;
}

export interface DeveloperEnvironmentProvider {
  getDeveloperEnvironmentSnapshot(
    deviceId: string,
  ): Promise<ProviderResult<DeveloperEnvironmentSnapshot>>;
}

export interface CryptoProvider {
  getCryptoSnapshot(deviceId: string): Promise<ProviderResult<CryptoSnapshot>>;
}

export interface CleanupProvider {
  getCleanupSnapshot(deviceId: string): Promise<ProviderResult<CleanupSnapshot>>;
}

/**
 * AIReportProvider is intentionally "bring your own AI": the interface has
 * no dependency on any specific vendor SDK. A concrete implementation may
 * call OpenAI, Anthropic, a local model, or Drave's own hosted service —
 * the dashboard only ever sees an `AIReportSnapshot`.
 */
export interface AIReportProvider {
  getAIReport(deviceId: string): Promise<ProviderResult<AIReportSnapshot>>;
}

export interface HistoryProvider {
  getHistory(deviceId: string): Promise<ProviderResult<HistoryEntry[]>>;
  /** Diffs two previously-scanned reports by id (as returned in
   * `HistoryEntry.id`). Implementations should return `status: 'empty'`
   * rather than an error when either id can't be resolved (e.g. history
   * was pruned) — see docs/HISTORY_FORMAT.md. */
  getComparison(previousId: string, currentId: string): Promise<ProviderResult<ComparisonResult>>;
}

/** Aggregate of every provider the dashboard depends on. Composed once at
 * the app root (see `src/providers/index.tsx`) and distributed via context. */
export interface ProviderRegistry {
  device: DeviceProvider;
  health: HealthProvider;
  storage: StorageProvider;
  security: SecurityProvider;
  performance: PerformanceProvider;
  developerEnvironment: DeveloperEnvironmentProvider;
  crypto: CryptoProvider;
  cleanup: CleanupProvider;
  aiReport: AIReportProvider;
  history: HistoryProvider;
}
