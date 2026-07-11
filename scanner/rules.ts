/**
 * Recommendation logic: plain functions over measured bytes, no rule
 * engine or DSL (see docs/SCANNER_DESIGN.md). Wallets, SSH keys, and other
 * protected material aren't scanned in this phase at all — they simply
 * never appear here, which is the simplest possible way to guarantee they
 * are never suggested for cleanup.
 */
import type { CleanupItem } from '../src/types';
import type { ToolMeasurement } from './collectStorage';

const GB = 1024 ** 3;
const DOWNLOADS_THRESHOLD = 5 * GB;
const TRASH_THRESHOLD = 1 * GB;

export function buildCleanupItems(input: {
  tools: ToolMeasurement[];
  downloadsBytes: number;
  trashBytes: number;
}): CleanupItem[] {
  const items: CleanupItem[] = [];

  if (input.trashBytes > TRASH_THRESHOLD) {
    items.push({
      id: 'trash',
      label: 'Empty Trash',
      bytes: input.trashBytes,
      risk: 'Safe',
      path: '~/.Trash',
      command: 'rm -rf ~/.Trash/*',
    });
  }

  for (const tool of input.tools) {
    if (tool.bytes < tool.largeThresholdBytes) continue;
    if (tool.riskLevel === 'Protected') continue; // never surfaced as cleanup, by construction
    items.push({
      id: tool.id,
      label: tool.label,
      bytes: tool.bytes,
      risk: tool.riskLevel === 'Safe' ? 'Safe' : 'Review',
      command: tool.cleanupCommand,
    });
  }

  if (input.downloadsBytes > DOWNLOADS_THRESHOLD) {
    items.push({
      id: 'downloads',
      label: 'Large Downloads folder',
      bytes: input.downloadsBytes,
      risk: 'Review', // user files — always review, never a one-click delete
      path: '~/Downloads',
    });
  }

  return items.sort((a, b) => b.bytes - a.bytes);
}
