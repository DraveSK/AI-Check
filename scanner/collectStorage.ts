import { homedir } from 'node:os';
import { join } from 'node:path';
import { statfsSync } from 'node:fs';
import type { StorageCategory, StorageFolder, StorageSnapshot, StorageToolMeasurement } from '../src/types';
import { directorySize, pathExists } from './fsSize.js';
import { KNOWN_TOOLS, type ToolSignature } from './signatures.js';

/** Top-level folders the spec asks us to size. Library gets a shallower
 * depth limit below since it's typically the largest, slowest tree. */
const TARGET_FOLDERS: { label: string; path: string; note?: string }[] = [
  { label: 'Applications', path: '/Applications' },
  { label: 'Downloads', path: join(homedir(), 'Downloads') },
  { label: 'Desktop', path: join(homedir(), 'Desktop') },
  { label: 'Documents', path: join(homedir(), 'Documents') },
  { label: 'Movies', path: join(homedir(), 'Movies') },
  { label: 'Music', path: join(homedir(), 'Music') },
  { label: 'Pictures', path: join(homedir(), 'Pictures') },
  { label: 'Library', path: join(homedir(), 'Library') },
  { label: 'Caches', path: join(homedir(), 'Library/Caches'), note: 'Regenerated automatically by apps as needed.' },
  { label: 'Application Support', path: join(homedir(), 'Library/Application Support') },
  { label: 'Trash', path: join(homedir(), '.Trash'), note: 'Already marked for deletion — safe to empty.' },
  { label: 'Developer', path: join(homedir(), 'Developer') },
];

export interface ToolMeasurement extends ToolSignature {
  bytes: number;
}

export interface StorageCollectionResult {
  storage: StorageSnapshot;
  tools: ToolMeasurement[];
  downloadsBytes: number;
  trashBytes: number;
}

async function measureFolder(label: string, path: string, note?: string): Promise<StorageFolder | null> {
  if (!(await pathExists(path))) return null;
  // Library itself is huge and mostly re-measured via Caches/Application
  // Support below — cap its own walk shallower so the overall scan stays fast.
  const depth = label === 'Library' ? 2 : 6;
  const bytes = await directorySize(path, { maxDepth: depth, maxEntries: 50_000 });
  return { path, label, bytes, percent: 0, note };
}

async function measureTools(): Promise<ToolMeasurement[]> {
  const results: ToolMeasurement[] = [];
  for (const tool of KNOWN_TOOLS) {
    const fullPath = join(homedir(), tool.relativePath);
    if (!(await pathExists(fullPath))) continue;
    const bytes = await directorySize(fullPath, { maxDepth: 4, maxEntries: 20_000 });
    if (bytes > 0) results.push({ ...tool, bytes });
  }
  return results;
}

function diskTotals(): { totalBytes: number; availableBytes: number; usedBytes: number } {
  const stats = statfsSync(homedir());
  const totalBytes = stats.blocks * stats.bsize;
  const availableBytes = stats.bavail * stats.bsize;
  return { totalBytes, availableBytes, usedBytes: totalBytes - availableBytes };
}

function buildCategories(folders: StorageFolder[], tools: ToolMeasurement[], totalBytes: number): StorageCategory[] {
  const developerBytes = tools.filter((t) => t.category === 'developer').reduce((sum, t) => sum + t.bytes, 0);
  const cacheBytes = tools.filter((t) => t.category === 'cache').reduce((sum, t) => sum + t.bytes, 0);
  const applicationsBytes = folders.find((f) => f.label === 'Applications')?.bytes ?? 0;

  const known = developerBytes + cacheBytes + applicationsBytes;
  const otherBytes = Math.max(totalBytes - known, 0);

  const toPercent = (bytes: number) => (totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0);

  return [
    { label: 'Developer tools & caches', bytes: developerBytes + cacheBytes, percent: toPercent(developerBytes + cacheBytes), colorToken: 'c2' },
    { label: 'Applications', bytes: applicationsBytes, percent: toPercent(applicationsBytes), colorToken: 'c1' },
    { label: 'System & other', bytes: otherBytes, percent: toPercent(otherBytes), colorToken: 'c4' },
  ];
}

/** Collects the macOS storage snapshot: target folders, known tool/cache
 * signatures, and real disk totals. Metadata only — every byte figure
 * comes from `stat()`, never from reading a file's contents. */
export async function collectStorage(): Promise<StorageCollectionResult> {
  const { totalBytes, availableBytes, usedBytes } = diskTotals();

  const measured = await Promise.all(TARGET_FOLDERS.map((f) => measureFolder(f.label, f.path, f.note)));
  const folders = measured.filter((f): f is StorageFolder => f !== null);
  for (const folder of folders) {
    folder.percent = totalBytes > 0 ? Math.round((folder.bytes / totalBytes) * 100) : 0;
  }

  const tools = await measureTools();
  const categories = buildCategories(folders, tools, totalBytes);

  const largestFolders = [...folders].sort((a, b) => b.bytes - a.bytes).slice(0, 10);

  const storage: StorageSnapshot = {
    totalBytes,
    usedBytes,
    availableBytes,
    capacityPercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
    // Set by report.ts once cleanup recommendations are computed, so this
    // number always matches the actual cleanup list shown in the UI.
    reclaimableBytes: 0,
    categories,
    largestFolders,
    // Full tool list (not just the top-N folders) so history comparisons
    // can track e.g. Docker even when it isn't currently among the
    // largest folders — see docs/HISTORY_FORMAT.md.
    tools: tools.map(
      (t): StorageToolMeasurement => ({ id: t.id, label: t.label, path: join(homedir(), t.relativePath), bytes: t.bytes }),
    ),
  };

  const downloadsBytes = folders.find((f) => f.label === 'Downloads')?.bytes ?? 0;
  const trashBytes = folders.find((f) => f.label === 'Trash')?.bytes ?? 0;

  return { storage, tools, downloadsBytes, trashBytes };
}
