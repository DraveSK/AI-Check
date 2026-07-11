import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runScan } from './report.js';
import { loadPreviousReport, saveToHistory } from './history.js';
import { compareReports } from '../src/utils/compareReports.js';
import { uploadReport } from './upload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'public', 'ai-check-report.json');

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1) + ' GB';
}

function signedGb(bytes: number): string {
  const sign = bytes > 0 ? '+' : bytes < 0 ? '-' : '';
  return sign + gb(Math.abs(bytes));
}

async function main() {
  console.log('Scanning storage — metadata only, no file contents are read...\n');

  const previous = await loadPreviousReport();
  const report = await runScan();

  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2));

  console.log(`Disk: ${gb(report.storage.usedBytes)} used of ${gb(report.storage.totalBytes)} (${report.storage.capacityPercent}%)`);
  console.log(`Reclaimable (safe): ${gb(report.storage.reclaimableBytes)}\n`);

  console.log('Largest folders:');
  for (const folder of report.storage.largestFolders.slice(0, 8)) {
    console.log(`  ${folder.label.padEnd(20)} ${gb(folder.bytes)}`);
  }

  console.log('\nCleanup suggestions:');
  if (report.cleanup.items.length === 0) {
    console.log('  Nothing above the size thresholds — nothing to suggest right now.');
  }
  for (const item of report.cleanup.items) {
    const cmd = item.command ? ` — ${item.command}` : '';
    console.log(`  [${item.risk}] ${item.label}: ${gb(item.bytes)}${cmd}`);
  }

  let changeBytes: number | undefined;
  if (previous) {
    const comparison = compareReports(previous, report);
    changeBytes = comparison.totalDeltaBytes;
    console.log(`\nSince last scan (${previous.collectedAt}):`);
    console.log(`  Disk usage: ${signedGb(comparison.totalDeltaBytes)}`);
    if (comparison.biggestGrowth) console.log(`  Biggest growth: ${comparison.biggestGrowth.label} ${signedGb(comparison.biggestGrowth.deltaBytes)}`);
    if (comparison.biggestCleanup) console.log(`  Biggest cleanup: ${comparison.biggestCleanup.label} ${signedGb(comparison.biggestCleanup.deltaBytes)}`);
    console.log(`  Recovered: ${gb(comparison.recoveredBytes)}`);
    for (const insight of comparison.insights) console.log(`  - ${insight.message}`);
  } else {
    console.log('\nThis is your first scan — nothing to compare yet. Run `npm run scan` again later to see what changed.');
  }

  const history = await saveToHistory(report, changeBytes);

  console.log(`\nWrote ${OUTPUT_PATH}`);
  console.log(`History: ${history.length} scan${history.length === 1 ? '' : 's'} saved locally in .ai-check-history/ (never uploaded).`);
  console.log('Run the dashboard with VITE_PROVIDER_MODE=local-report to see this in the UI.');

  // Local-first by default — nothing is ever uploaded unless this exact
  // flag is passed. See PRIVACY.md and scanner/upload.ts.
  if (process.argv.includes('--upload')) {
    console.log('\nUploading report...');
    const result = await uploadReport(report);
    if (result) console.log(`Uploaded. Report ID: ${result.id}`);
  }
}

main().catch((error) => {
  console.error('Scan failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
