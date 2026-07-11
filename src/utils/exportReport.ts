import type { ComparisonResult, HistoryEntry, InspectionReport } from '../types';
import { EXPORT_EXTENSION, EXPORT_MIME, comparisonToHTML, comparisonToMarkdown, historyToMarkdown, reportToHTML, reportToMarkdown, type ExportFormat } from './exportFormat';

export type { ExportFormat } from './exportFormat';

/** Triggers a browser download — no backend involved, everything stays on
 * the user's machine unless the export happened via the API (see
 * worker/routes/export.ts, which uses the same formatters in
 * ./exportFormat.ts without this browser-only trigger). */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportReport(report: InspectionReport, format: ExportFormat): void {
  const content = format === 'json' ? JSON.stringify(report, null, 2) : format === 'markdown' ? reportToMarkdown(report) : reportToHTML(report);
  downloadFile(`ai-check-report.${EXPORT_EXTENSION[format]}`, content, EXPORT_MIME[format]);
}

export function exportComparison(result: ComparisonResult, format: ExportFormat): void {
  const content = format === 'json' ? JSON.stringify(result, null, 2) : format === 'markdown' ? comparisonToMarkdown(result) : comparisonToHTML(result);
  downloadFile(`ai-check-comparison.${EXPORT_EXTENSION[format]}`, content, EXPORT_MIME[format]);
}

export function exportHistory(entries: HistoryEntry[], format: ExportFormat): void {
  const content = format === 'json' ? JSON.stringify(entries, null, 2) : historyToMarkdown(entries);
  downloadFile(`ai-check-history.${format === 'json' ? 'json' : 'md'}`, content, format === 'json' ? EXPORT_MIME.json : EXPORT_MIME.markdown);
}
