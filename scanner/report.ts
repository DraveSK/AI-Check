import { hostname, platform, release } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { DeviceInfo, InspectionReport } from '../src/types';
import { collectStorage } from './collectStorage.js';
import { buildCleanupItems } from './rules.js';

const SCANNER_VERSION = '0.1.0';

function detectPlatform(): DeviceInfo['platform'] {
  const p = platform();
  if (p === 'darwin') return 'macos';
  if (p === 'win32') return 'windows';
  return 'linux';
}

/** `sysctl -n hw.model` — metadata only (e.g. "Mac15,6"), not a serial
 * number or any other identifying data. Never fails the scan if absent. */
function macModel(): string | undefined {
  try {
    return execFileSync('sysctl', ['-n', 'hw.model'], { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Runs the storage collector and assembles one InspectionReport. Security,
 * performance, developer-environment, and crypto snapshots are omitted —
 * they're out of scope for this phase (see docs/SCANNER_SPEC.md) and are
 * optional fields on InspectionReport for exactly this reason. */
export async function runScan(): Promise<InspectionReport> {
  if (detectPlatform() !== 'macos') {
    throw new Error('Only macOS is implemented so far — see docs/SCANNER_SPEC.md for Windows/Linux plans.');
  }

  const { storage, tools, downloadsBytes, trashBytes } = await collectStorage();
  const cleanupItems = buildCleanupItems({ tools, downloadsBytes, trashBytes });
  const reclaimableBytes = cleanupItems.filter((i) => i.risk === 'Safe').reduce((sum, i) => sum + i.bytes, 0);
  storage.reclaimableBytes = reclaimableBytes; // keep in sync with the actual cleanup list below

  const device: DeviceInfo = {
    id: randomUUID(),
    name: hostname(),
    platform: 'macos',
    osVersion: `macOS ${release()}`,
    lastInspectedAt: new Date().toISOString(),
    model: macModel(),
  };

  const report: InspectionReport = {
    schemaVersion: '1.0',
    device,
    storage,
    // Not yet implemented — see docs/SCANNER_SPEC.md and ROADMAP.md v0.8.
    security: { malwareIndicatorsFound: false, itemsNeedingReview: 0, findings: [] },
    performance: { cpuPercent: 0, memoryPercent: 0, sparkline: [], metrics: [] },
    developerEnvironment: { toolCount: 0, totalBytes: 0, tools: [] },
    crypto: { walletsDetected: 0, wallets: [] },
    cleanup: {
      totalReclaimableBytes: reclaimableBytes,
      items: cleanupItems,
    },
    collectedAt: new Date().toISOString(),
    scannerVersion: SCANNER_VERSION,
  };

  return report;
}
