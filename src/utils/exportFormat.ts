import type { ComparisonResult, HistoryEntry, InspectionReport } from '../types';
import { formatBytes } from './format';

/**
 * Pure string formatters — no DOM, no browser APIs. Deliberately
 * separated from exportReport.ts (which adds `downloadFile()`, a
 * browser-only helper) so this module can be imported by the Worker too
 * (see worker/routes/export.ts) without pulling in a `document` reference
 * that doesn't exist in that runtime.
 */

export type ExportFormat = 'json' | 'markdown' | 'html';

/** `formatBytes` doesn't prefix a `+` for positive numbers (it's also used
 * for plain non-negative sizes) — this does, for signed deltas. */
export function signedBytes(bytes: number): string {
  return bytes > 0 ? `+${formatBytes(bytes)}` : formatBytes(bytes);
}

export const EXPORT_MIME: Record<ExportFormat, string> = {
  json: 'application/json',
  markdown: 'text/markdown',
  html: 'text/html',
};

export const EXPORT_EXTENSION: Record<ExportFormat, string> = {
  json: 'json',
  markdown: 'md',
  html: 'html',
};

function htmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px/1.5 -apple-system,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#20212b}
h1{font-size:22px}h2{font-size:16px;margin-top:28px}table{width:100%;border-collapse:collapse;margin-top:8px}
td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #e6e7ed;font-size:13px}
.growth{color:#b3492f}.recovered{color:#25875e}</style></head>
<body>${bodyHtml}</body></html>`;
}

export function reportToMarkdown(report: InspectionReport): string {
  const lines = [
    `# AI Check Report — ${report.device.name}`,
    ``,
    `Scanned ${report.collectedAt} · ${report.device.osVersion}${report.device.model ? ` · ${report.device.model}` : ''}`,
    ``,
    `## Storage`,
    ``,
    `- Used: ${formatBytes(report.storage.usedBytes)} / ${formatBytes(report.storage.totalBytes)} (${report.storage.capacityPercent}%)`,
    `- Reclaimable (safe): ${formatBytes(report.storage.reclaimableBytes)}`,
    ``,
    `### Largest folders`,
    ``,
    ...report.storage.largestFolders.map((f) => `- ${f.label}: ${formatBytes(f.bytes)}`),
    ``,
    `### Cleanup suggestions`,
    ``,
    ...(report.cleanup.items.length === 0
      ? ['Nothing above the size thresholds.']
      : report.cleanup.items.map((i) => `- [${i.risk}] ${i.label}: ${formatBytes(i.bytes)}${i.command ? ` — \`${i.command}\`` : ''}`)),
  ];
  return lines.join('\n');
}

export function reportToHTML(report: InspectionReport): string {
  const rows = report.storage.largestFolders
    .map((f) => `<tr><td>${f.label}</td><td>${formatBytes(f.bytes)}</td></tr>`)
    .join('');
  const cleanupRows = report.cleanup.items
    .map((i) => `<tr><td>${i.risk}</td><td>${i.label}</td><td>${formatBytes(i.bytes)}</td><td>${i.command ?? ''}</td></tr>`)
    .join('');
  return htmlDocument(
    `AI Check Report — ${report.device.name}`,
    `<h1>AI Check Report — ${report.device.name}</h1>
     <p>Scanned ${report.collectedAt} · ${report.device.osVersion}</p>
     <h2>Storage</h2>
     <p>${formatBytes(report.storage.usedBytes)} / ${formatBytes(report.storage.totalBytes)} used (${report.storage.capacityPercent}%) · ${formatBytes(report.storage.reclaimableBytes)} reclaimable</p>
     <table><tr><th>Folder</th><th>Size</th></tr>${rows}</table>
     <h2>Cleanup suggestions</h2>
     <table><tr><th>Risk</th><th>Item</th><th>Size</th><th>Command</th></tr>${cleanupRows || '<tr><td colspan="4">None</td></tr>'}</table>`,
  );
}

export function comparisonToMarkdown(result: ComparisonResult): string {
  const lines = [
    `# Storage Comparison`,
    ``,
    `${result.previous.collectedAt} → ${result.current.collectedAt}`,
    ``,
    `- Total change: ${signedBytes(result.totalDeltaBytes)}`,
    `- Recovered: ${formatBytes(result.recoveredBytes)}`,
    ``,
    `## Grown`,
    ``,
    ...(result.grown.length === 0 ? ['None.'] : result.grown.map((d) => `- ${d.label}: ${formatBytes(d.previousBytes)} → ${formatBytes(d.currentBytes)} (+${formatBytes(d.deltaBytes)})`)),
    ``,
    `## Shrunk`,
    ``,
    ...(result.shrunk.length === 0 ? ['None.'] : result.shrunk.map((d) => `- ${d.label}: ${formatBytes(d.previousBytes)} → ${formatBytes(d.currentBytes)} (-${formatBytes(Math.abs(d.deltaBytes))})`)),
  ];
  return lines.join('\n');
}

export function comparisonToHTML(result: ComparisonResult): string {
  const row = (d: (typeof result.grown)[number], tone: 'growth' | 'recovered') =>
    `<tr class="${tone}"><td>${d.label}</td><td>${formatBytes(d.previousBytes)}</td><td>${formatBytes(d.currentBytes)}</td><td>${signedBytes(d.deltaBytes)}</td></tr>`;
  return htmlDocument(
    'Storage Comparison',
    `<h1>Storage Comparison</h1>
     <p>${result.previous.collectedAt} &rarr; ${result.current.collectedAt}</p>
     <p>Total change: ${signedBytes(result.totalDeltaBytes)} · Recovered: ${formatBytes(result.recoveredBytes)}</p>
     <table><tr><th>Folder</th><th>Before</th><th>After</th><th>Change</th></tr>
       ${result.grown.map((d) => row(d, 'growth')).join('')}
       ${result.shrunk.map((d) => row(d, 'recovered')).join('')}
     </table>`,
  );
}

export function historyToMarkdown(entries: HistoryEntry[]): string {
  const lines = [
    `# Scan History`,
    ``,
    `| Date | Used | Reclaimable | Largest folder | Change |`,
    `|---|---|---|---|---|`,
    ...entries.map(
      (e) =>
        `| ${e.inspectedAt} | ${e.usedBytes ? formatBytes(e.usedBytes) : '—'} | ${e.reclaimableBytes ? formatBytes(e.reclaimableBytes) : '—'} | ${e.largestFolderLabel ?? '—'} | ${e.changeBytes != null ? signedBytes(e.changeBytes) : '—'} |`,
    ),
  ];
  return lines.join('\n');
}
