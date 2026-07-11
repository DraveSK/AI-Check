import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HistoryEntry, InspectionReport } from '../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Durable local history — never uploaded, never read by the browser.
const HISTORY_DIR = join(ROOT, '.ai-check-history');
const REPORTS_DIR = join(HISTORY_DIR, 'reports');
const INDEX_PATH = join(HISTORY_DIR, 'index.json');
const LOCAL_RETENTION = 200;

// A trimmed copy the dashboard can fetch as static files (see
// src/providers/local-report). Capped separately and much smaller — this
// is a local dev server serving local JSON, not a network boundary.
const PUBLIC_HISTORY_DIR = join(ROOT, 'public', 'ai-check-history');
const PUBLIC_INDEX_PATH = join(ROOT, 'public', 'ai-check-history-index.json');
const PUBLISHED_REPORTS = 20;
const PUBLISHED_INDEX_ENTRIES = 100;

/** A scan's collectedAt timestamp doubles as its history id — unique per
 * scan (scans don't run twice in the same millisecond) and requires no
 * extra field on InspectionReport. See docs/HISTORY_FORMAT.md. */
export function scanIdFor(report: InspectionReport): string {
  return report.collectedAt.replace(/[:.]/g, '-');
}

async function readJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

async function readIndex(dir: string): Promise<HistoryEntry[]> {
  return readJSON<HistoryEntry[]>(dir, []);
}

/** Loads the most recent report saved by a previous run, if any. */
export async function loadPreviousReport(): Promise<InspectionReport | null> {
  const index = await readIndex(INDEX_PATH);
  if (index.length === 0) return null;
  return readJSON<InspectionReport | null>(join(REPORTS_DIR, `${index[0].id}.json`), null);
}

function toHistoryEntry(report: InspectionReport, changeBytes?: number): HistoryEntry {
  const largest = report.storage.largestFolders[0];
  return {
    id: scanIdFor(report),
    deviceName: report.device.name,
    inspectedAt: report.collectedAt,
    // Security/Performance aren't scanned yet (see docs/NEXT_COLLECTOR.md),
    // so this is a storage-only proxy — documented in docs/HISTORY_FORMAT.md,
    // not a fabricated overall health score.
    healthScore: Math.max(0, 100 - report.storage.capacityPercent),
    usedBytes: report.storage.usedBytes,
    totalBytes: report.storage.totalBytes,
    reclaimableBytes: report.storage.reclaimableBytes,
    largestFolderLabel: largest?.label,
    largestFolderBytes: largest?.bytes,
    changeBytes,
  };
}

/**
 * Saves a completed report to local history and publishes a trimmed,
 * dashboard-readable copy to `public/`. Never uploads anything — see
 * PRIVACY.md and docs/HISTORY_FORMAT.md.
 */
export async function saveToHistory(report: InspectionReport, changeBytes?: number): Promise<HistoryEntry[]> {
  await mkdir(REPORTS_DIR, { recursive: true });
  await mkdir(PUBLIC_HISTORY_DIR, { recursive: true });

  const id = scanIdFor(report);
  await writeFile(join(REPORTS_DIR, `${id}.json`), JSON.stringify(report, null, 2));

  const index = await readIndex(INDEX_PATH);
  index.unshift(toHistoryEntry(report, changeBytes));

  // Prune local history beyond retention — delete the report files first,
  // then drop their index entries, so a crash mid-prune never leaves an
  // index entry pointing at a missing file.
  const toPrune = index.slice(LOCAL_RETENTION);
  for (const entry of toPrune) {
    await rm(join(REPORTS_DIR, `${entry.id}.json`), { force: true });
  }
  const trimmedIndex = index.slice(0, LOCAL_RETENTION);
  await writeIndex(INDEX_PATH, trimmedIndex);

  await publishForDashboard(trimmedIndex);
  return trimmedIndex;
}

async function writeIndex(path: string, entries: HistoryEntry[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(entries, null, 2));
}

/** Copies the last N full reports and the summary index into `public/` so
 * the browser (which can only fetch static files, not read the local
 * filesystem) can render history and run comparisons client-side. */
async function publishForDashboard(index: HistoryEntry[]): Promise<void> {
  const publishedIndex = index.slice(0, PUBLISHED_INDEX_ENTRIES);
  await writeIndex(PUBLIC_INDEX_PATH, publishedIndex);

  const toPublish = index.slice(0, PUBLISHED_REPORTS);
  for (const entry of toPublish) {
    const report = await readJSON<InspectionReport | null>(join(REPORTS_DIR, `${entry.id}.json`), null);
    if (report) await writeFile(join(PUBLIC_HISTORY_DIR, `${entry.id}.json`), JSON.stringify(report, null, 2));
  }

  // Drop any previously-published report files that fell out of the
  // published window, so public/ai-check-history/ never grows unbounded.
  const keep = new Set(toPublish.map((e) => `${e.id}.json`));
  let existing: string[] = [];
  try {
    existing = await readdir(PUBLIC_HISTORY_DIR);
  } catch {
    existing = [];
  }
  for (const file of existing) {
    if (!keep.has(file)) await rm(join(PUBLIC_HISTORY_DIR, file), { force: true });
  }
}
