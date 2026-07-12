import type { RouteContext } from '../router';
import type { InspectionReport } from '../../src/types';
import { apiError } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission } from '../lib/rbac';
import { safeParseJSON, exportQuerySchema } from '../lib/validation';
import { getReport } from '../lib/db';
import { getReportJSON } from '../lib/r2';
import { reportToMarkdown, reportToHTML } from '../../src/utils/exportFormat';

const CONTENT_TYPE = { json: 'application/json', markdown: 'text/markdown', html: 'text/html' } as const;
const EXTENSION = { json: 'json', markdown: 'md', html: 'html' } as const;

/**
 * GET /api/v1/export?reportId=&format= — server-side counterpart to the
 * dashboard's client-side export (src/utils/exportReport.ts). Same pure
 * formatter functions, two call sites: the browser formats an
 * already-fetched report locally, this route formats one fetched from
 * R2. Useful for scripting/automation against the hosted API without a
 * browser involved.
 */
export async function exportReportRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'REPORTS');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'reports.read');
  if (user instanceof Response) return user;

  const url = new URL(ctx.request.url);
  const parsed = safeParseJSON(exportQuerySchema, { reportId: url.searchParams.get('reportId'), format: url.searchParams.get('format') });
  if (!parsed.success) return apiError('invalid_request', 'reportId and format (json|markdown|html) are required.', parsed.errors);

  const row = await getReport(ctx.env.DB!, user.id, parsed.data.reportId);
  if (!row) return apiError('not_found', 'Report not found.');
  const report = await getReportJSON<InspectionReport>(ctx.env.REPORTS!, row.r2_key);
  if (!report) return apiError('not_found', 'Report metadata exists but the stored file is missing.');

  const format = parsed.data.format;
  const content = format === 'json' ? JSON.stringify(report, null, 2) : format === 'markdown' ? reportToMarkdown(report) : reportToHTML(report);

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPE[format],
      'Content-Disposition': `attachment; filename="ai-check-report-${row.id}.${EXTENSION[format]}"`,
    },
  });
}
