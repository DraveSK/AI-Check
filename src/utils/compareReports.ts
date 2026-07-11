import type {
  ComparisonInsight,
  ComparisonResult,
  FolderDelta,
  HistoryEntry,
  InspectionReport,
  StorageFolder,
} from '../types';

/** Changes smaller than this are noise (filesystem metadata drift, a
 * browser writing a few MB of cache) — never surfaced as growth/shrink. */
export const CHANGE_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB

interface TrackedItem {
  label: string;
  path: string;
  bytes: number;
}

function trackedItems(report: InspectionReport): Map<string, TrackedItem> {
  const items = new Map<string, TrackedItem>();
  for (const folder of report.storage.largestFolders) {
    items.set(folder.path, { label: folder.label, path: folder.path, bytes: folder.bytes });
  }
  for (const tool of report.storage.tools ?? []) {
    items.set(tool.path, { label: tool.label, path: tool.path, bytes: tool.bytes });
  }
  return items;
}

/**
 * Pure diff between two InspectionReports. No filesystem access, no
 * network — safe to run in the browser (History page) or in the scanner
 * CLI (terminal summary). See docs/HISTORY_FORMAT.md.
 */
export function compareReports(
  previous: InspectionReport,
  current: InspectionReport,
  thresholdBytes = CHANGE_THRESHOLD_BYTES,
): ComparisonResult {
  const previousItems = trackedItems(previous);
  const currentItems = trackedItems(current);

  const newFolders: StorageFolder[] = current.storage.largestFolders.filter((f) => !previousItems.has(f.path));
  const removedFolders: StorageFolder[] = previous.storage.largestFolders.filter((f) => !currentItems.has(f.path));

  const grown: FolderDelta[] = [];
  const shrunk: FolderDelta[] = [];
  const unchanged: FolderDelta[] = [];

  for (const [path, curr] of currentItems) {
    const prev = previousItems.get(path);
    if (!prev) continue; // handled as "new" above
    const deltaBytes = curr.bytes - prev.bytes;
    const delta: FolderDelta = { label: curr.label, path, previousBytes: prev.bytes, currentBytes: curr.bytes, deltaBytes };
    if (deltaBytes > thresholdBytes) grown.push(delta);
    else if (deltaBytes < -thresholdBytes) shrunk.push(delta);
    else unchanged.push(delta);
  }

  grown.sort((a, b) => b.deltaBytes - a.deltaBytes);
  shrunk.sort((a, b) => a.deltaBytes - b.deltaBytes);

  const biggestGrowth = grown[0] ?? null;
  const biggestCleanup = shrunk[0] ?? null;
  const recoveredBytes = shrunk.reduce((sum, d) => sum + Math.abs(d.deltaBytes), 0);
  const totalDeltaBytes = current.storage.usedBytes - previous.storage.usedBytes;

  const insights: ComparisonInsight[] = [];
  for (const item of grown) {
    insights.push({ id: `growth-${item.path}`, tone: 'growth', message: `${item.label} grew by ${formatDeltaGB(item.deltaBytes)}. Review what's using the extra space.` });
  }
  for (const item of shrunk) {
    insights.push({ id: `recovered-${item.path}`, tone: 'recovered', message: `${item.label} shrank by ${formatDeltaGB(-item.deltaBytes)}. No action required.` });
  }
  if (insights.length === 0) {
    insights.push({ id: 'no-change', tone: 'neutral', message: 'No significant storage changes since the last scan.' });
  }

  return {
    // The scan's collectedAt timestamp doubles as its history id — see
    // scanner/history.ts and docs/HISTORY_FORMAT.md. device.id is a
    // per-scan random identifier today, not a stable scan id, so it isn't
    // used here.
    previous: { id: previous.collectedAt, collectedAt: previous.collectedAt },
    current: { id: current.collectedAt, collectedAt: current.collectedAt },
    newFolders,
    removedFolders,
    grown,
    shrunk,
    unchanged,
    biggestGrowth,
    biggestCleanup,
    totalDeltaBytes,
    recoveredBytes,
    insights,
  };
}

function formatDeltaGB(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}

/** Renders an ISO timestamp as a short relative label ("3 hours ago"). No
 * date library — this is the one thing needed and it's a dozen lines. */
export function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface HistoryStats {
  totalRecoveredBytes: number;
  largestCleanupEverBytes: number;
  averageRecoveryBytes: number;
  trend: 'growing' | 'shrinking' | 'stable';
  scanCount: number;
}

/** Derives simple aggregate stats from the history index alone — no need
 * to fetch full reports. See HistoryEntry.changeBytes in src/types. */
export function computeHistoryStats(entries: HistoryEntry[]): HistoryStats {
  const changes = entries.map((e) => e.changeBytes).filter((v): v is number => typeof v === 'number');
  const recoveries = changes.filter((v) => v < 0).map((v) => Math.abs(v));

  const totalRecoveredBytes = recoveries.reduce((sum, v) => sum + v, 0);
  const largestCleanupEverBytes = recoveries.length > 0 ? Math.max(...recoveries) : 0;
  const averageRecoveryBytes = recoveries.length > 0 ? totalRecoveredBytes / recoveries.length : 0;

  const recentTrendWindow = changes.slice(0, 5);
  const netRecent = recentTrendWindow.reduce((sum, v) => sum + v, 0);
  const trend: HistoryStats['trend'] = netRecent > CHANGE_THRESHOLD_BYTES ? 'growing' : netRecent < -CHANGE_THRESHOLD_BYTES ? 'shrinking' : 'stable';

  return { totalRecoveredBytes, largestCleanupEverBytes, averageRecoveryBytes, trend, scanCount: entries.length };
}
