import type { DeviceInfo, HistoryEntry, InspectionReport, ProviderResult } from '../../types';
import type { ProviderRegistry } from '../types';
import { mockProviders } from '../mock';
import { compareReports } from '../../utils/compareReports';

const REPORT_URL = '/ai-check-report.json';
const HISTORY_INDEX_URL = '/ai-check-history-index.json';
const HISTORY_REPORT_URL = (id: string) => `/ai-check-history/${id}.json`;

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

let cachedHistory: Promise<HistoryEntry[]> | null = null;

function loadHistoryIndex(): Promise<HistoryEntry[]> {
  if (!cachedHistory) {
    cachedHistory = fetch(HISTORY_INDEX_URL)
      .then((res) => (res.ok ? (res.json() as Promise<HistoryEntry[]>) : []))
      .catch(() => []);
  }
  return cachedHistory;
}

/** Only the last 20 full reports are published for the browser to fetch
 * (see scanner/history.ts) — older scans remain in local history but
 * aren't individually comparable from the dashboard. */
async function loadHistoryReport(id: string): Promise<InspectionReport | null> {
  try {
    const res = await fetch(HISTORY_REPORT_URL(id));
    return res.ok ? ((await res.json()) as InspectionReport) : null;
  } catch {
    return null;
  }
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
 * Reads real scan results from `public/ai-check-report.json` and
 * `public/ai-check-history*` (all written by `npm run scan`, see
 * scanner/cli.ts and scanner/history.ts). Storage, cleanup, device, and
 * history/comparison are backed by real data; security, performance,
 * developer environment, crypto, and AI report stay on the mock registry
 * until their own collectors exist (see docs/NEXT_COLLECTOR.md).
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
  history: {
    getHistory: async () => {
      const entries = await loadHistoryIndex();
      if (entries.length === 0) return { status: 'empty', data: null, source: 'local-scanner' };
      return { status: 'ready', data: entries, source: 'local-scanner' };
    },
    getComparison: async (previousId, currentId) => {
      const [previous, current] = await Promise.all([loadHistoryReport(previousId), loadHistoryReport(currentId)]);
      if (!previous || !current) {
        // Most likely one of the two scans fell outside the published
        // window (see scanner/history.ts §PUBLISHED_REPORTS) — this is an
        // expected, non-error condition, not a fetch failure.
        return { status: 'empty', data: null, source: 'local-scanner' };
      }
      return { status: 'ready', data: compareReports(previous, current), source: 'local-scanner' };
    },
  },
};
