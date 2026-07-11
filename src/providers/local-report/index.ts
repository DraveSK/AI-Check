import type { DeviceInfo, InspectionReport, ProviderResult } from '../../types';
import type { ProviderRegistry } from '../types';
import { mockProviders } from '../mock';

const REPORT_URL = '/ai-check-report.json';

/** Fetches the report written by `npm run scan` once and caches it for the
 * session — every provider method below reads from this same promise. */
let cached: Promise<InspectionReport | null> | null = null;

function loadReport(): Promise<InspectionReport | null> {
  if (!cached) {
    cached = fetch(REPORT_URL)
      .then((res) => (res.ok ? (res.json() as Promise<InspectionReport>) : null))
      .catch(() => null);
  }
  return cached;
}

function fromReport<T>(pick: (report: InspectionReport) => T): () => Promise<ProviderResult<T>> {
  return async () => {
    const report = await loadReport();
    if (!report) {
      return {
        status: 'empty',
        data: null,
        source: 'local-scanner',
      };
    }
    return {
      status: 'ready',
      data: pick(report),
      source: 'local-scanner',
      generatedAt: report.collectedAt,
    };
  };
}

/**
 * Reads real scan results from `public/ai-check-report.json` (written by
 * `npm run scan`, see scanner/cli.ts). Only storage, cleanup, and device
 * are backed by real data so far — security, performance, developer
 * environment, crypto, AI report, health, and history stay on the mock
 * registry until their own collectors exist (see docs/NEXT_COLLECTOR.md).
 */
export const localReportProviders: ProviderRegistry = {
  ...mockProviders,
  device: {
    getActiveDevice: fromReport<DeviceInfo>((r) => r.device),
  },
  storage: {
    getStorageSnapshot: fromReport((r) => r.storage),
  },
  cleanup: {
    getCleanupSnapshot: fromReport((r) => r.cleanup),
  },
};
