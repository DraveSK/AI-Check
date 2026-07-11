import type {
  AIReportSnapshot,
  ComparisonResult,
  DeviceInfo,
  HistoryEntry,
  InspectionReport,
  ProviderResult,
} from '../../types';
import type { ProviderRegistry } from '../types';
import { mockProviders } from '../mock';
import { apiFetch } from './client';

async function safely<T>(fn: () => Promise<T>): Promise<ProviderResult<T>> {
  try {
    const data = await fn();
    return { status: 'ready', data, source: 'cloud-api', generatedAt: new Date().toISOString() };
  } catch (error) {
    return { status: 'error', data: null, source: 'cloud-api', error: error instanceof Error ? error.message : 'Request failed.' };
  }
}

let latestReportCache: Promise<InspectionReport | null> | null = null;

async function loadLatestReport(): Promise<InspectionReport | null> {
  if (!latestReportCache) {
    latestReportCache = (async () => {
      const history = await apiFetch<{ id: string }[]>('/api/v1/report/history');
      if (history.length === 0) return null;
      return apiFetch<InspectionReport>(`/api/v1/report/${history[0].id}`);
    })();
  }
  return latestReportCache;
}

/**
 * Talks to the real hosted API (worker/routes/*.ts) via the browser's
 * session cookie — see docs/API.md. Only storage/cleanup/device/history/
 * AI-report are backed by real endpoints; security/performance/developer
 * environment/crypto stay on the mock registry because those collectors
 * don't exist server-side either (the API only ever received what the
 * scanner sends — storage, today). See docs/NEXT_COLLECTOR.md.
 */
export const cloudApiProviders: ProviderRegistry = {
  ...mockProviders,
  device: {
    getActiveDevice: () =>
      safely<DeviceInfo>(async () => {
        const report = await loadLatestReport();
        if (!report) throw new Error('No scans uploaded yet.');
        return report.device;
      }),
  },
  storage: {
    getStorageSnapshot: () =>
      safely(async () => {
        const report = await loadLatestReport();
        if (!report) throw new Error('No scans uploaded yet.');
        return report.storage;
      }),
  },
  cleanup: {
    getCleanupSnapshot: () =>
      safely(async () => {
        const report = await loadLatestReport();
        if (!report) throw new Error('No scans uploaded yet.');
        return report.cleanup;
      }),
  },
  history: {
    getHistory: () =>
      safely<HistoryEntry[]>(async () => {
        const rows = await apiFetch<
          { id: string; device_id: string; used_bytes: number; total_bytes: number; reclaimable_bytes: number; collected_at: string }[]
        >('/api/v1/report/history');
        return rows.map((r) => ({
          id: r.id,
          deviceName: r.device_id,
          inspectedAt: r.collected_at,
          healthScore: Math.max(0, 100 - Math.round((r.used_bytes / r.total_bytes) * 100)),
          usedBytes: r.used_bytes,
          totalBytes: r.total_bytes,
          reclaimableBytes: r.reclaimable_bytes,
        }));
      }),
    getComparison: (previousId, currentId) =>
      safely<ComparisonResult>(() => apiFetch(`/api/v1/report/compare?previousId=${encodeURIComponent(previousId)}&currentId=${encodeURIComponent(currentId)}`)),
  },
  aiReport: {
    getAIReport: () =>
      safely<AIReportSnapshot>(async () => {
        const history = await apiFetch<{ id: string }[]>('/api/v1/report/history');
        if (history.length === 0) throw new Error('No scans uploaded yet.');
        const settings = await apiFetch<{ preferredAiProvider: string | null; preferredAiModel: string | null }>('/api/v1/settings');
        if (!settings.preferredAiProvider || !settings.preferredAiModel) {
          throw new Error('No AI provider configured — add one in Settings.');
        }
        return apiFetch<AIReportSnapshot>('/api/v1/analyze', {
          method: 'POST',
          body: JSON.stringify({ reportId: history[0].id, provider: settings.preferredAiProvider, model: settings.preferredAiModel }),
        });
      }),
  },
};
