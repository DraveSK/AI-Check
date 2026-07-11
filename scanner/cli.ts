import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runScan } from './report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'public', 'ai-check-report.json');

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1) + ' GB';
}

async function main() {
  console.log('Scanning storage — metadata only, no file contents are read...\n');
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

  console.log(`\nWrote ${OUTPUT_PATH}`);
  console.log('Run the dashboard with VITE_PROVIDER_MODE=local-report to see this in the UI.');
}

main().catch((error) => {
  console.error('Scan failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
