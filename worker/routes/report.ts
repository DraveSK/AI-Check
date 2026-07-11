import type { RouteContext } from '../router';
import type { InspectionReport } from '../../src/types';
import { apiError, ok, pick } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requireUser } from '../lib/auth';
import { safeParseJSON, inspectionReportSchema, compareQuerySchema } from '../lib/validation';
import { upsertDevice, insertReport, getReport, listReports, recordAudit, type ReportRow } from '../lib/db';
import { putReport, getReportJSON } from '../lib/r2';
import { checkRateLimit, RATE_LIMITS } from '../lib/ratelimit';
import { compareReports } from '../../src/utils/compareReports';
import { log } from '../lib/log';

const REPORT_LIST_FIELDS = ['id', 'device_id', 'schema_version', 'scanner_version', 'used_bytes', 'total_bytes', 'reclaimable_bytes', 'collected_at', 'created_at'] as const;

/**
 * POST /api/v1/report — the scanner's upload endpoint (see
 * scanner/upload.ts and docs/API.md). Validates the full
 * InspectionReport shape before anything is persisted — an invalid
 * report is rejected outright, never partially stored (see
 * docs/API.md "Store the raw payload immutably").
 */
export async function uploadReport(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'REPORTS');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  const allowed = await checkRateLimit(ctx.env, RATE_LIMITS.upload, user.id);
  if (!allowed) return apiError('rate_limited', 'Too many uploads. Try again later.');

  const body = await ctx.request.json().catch(() => null);
  const parsed = safeParseJSON(inspectionReportSchema, body);
  if (!parsed.success) return apiError('invalid_report', 'The uploaded report does not match the InspectionReport schema.', parsed.errors);

  const report = parsed.data as InspectionReport;
  const device = await upsertDevice(ctx.env.DB!, user.id, {
    name: report.device.name,
    platform: report.device.platform,
    osVersion: report.device.osVersion,
    model: report.device.model,
  });

  const reportId = crypto.randomUUID();
  const r2Key = await putReport(ctx.env.REPORTS!, user.id, reportId, report);

  const row: ReportRow = {
    id: reportId,
    user_id: user.id,
    device_id: device.id,
    schema_version: report.schemaVersion,
    scanner_version: report.scannerVersion,
    r2_key: r2Key,
    used_bytes: report.storage.usedBytes,
    total_bytes: report.storage.totalBytes,
    reclaimable_bytes: report.storage.reclaimableBytes,
    collected_at: report.collectedAt,
    created_at: new Date().toISOString(),
  };
  await insertReport(ctx.env.DB!, row);
  await recordAudit(ctx.env.DB!, user.id, 'report.upload', { reportId, deviceId: device.id, usedBytes: row.used_bytes });

  log.info({ category: 'api', event: 'report_uploaded', requestId: ctx.requestId, userId: user.id, status: 201 });
  return ok({ id: reportId, deviceId: device.id, accepted: true }, 201);
}

/** GET /api/v1/report/:id — a single full report. */
export async function getReportById(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'REPORTS');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  const row = await getReport(ctx.env.DB!, user.id, ctx.params.id);
  if (!row) return apiError('not_found', 'Report not found.');
  const report = await getReportJSON<InspectionReport>(ctx.env.REPORTS!, row.r2_key);
  if (!report) return apiError('not_found', 'Report metadata exists but the stored file is missing.');
  return ok(report);
}

/** GET /api/v1/report/history?deviceId= — lightweight summaries, never
 * full reports, matching the pattern already established for the local
 * scanner's history index (see docs/HISTORY_FORMAT.md). */
export async function reportHistory(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  const deviceId = new URL(ctx.request.url).searchParams.get('deviceId') ?? undefined;
  const rows = await listReports(ctx.env.DB!, user.id, deviceId);
  return ok(rows.map((r) => pick(r, REPORT_LIST_FIELDS)));
}

/** GET /api/v1/report/compare?previousId=&currentId= — reuses the exact
 * same compareReports() the local dashboard and scanner CLI use (see
 * src/utils/compareReports.ts and docs/HISTORY_FORMAT.md) — one
 * implementation, now three call sites. */
export async function compareReportsRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'REPORTS');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  const url = new URL(ctx.request.url);
  const parsed = safeParseJSON(compareQuerySchema, { previousId: url.searchParams.get('previousId'), currentId: url.searchParams.get('currentId') });
  if (!parsed.success) return apiError('invalid_request', 'previousId and currentId are required.', parsed.errors);

  const [previousRow, currentRow] = await Promise.all([
    getReport(ctx.env.DB!, user.id, parsed.data.previousId),
    getReport(ctx.env.DB!, user.id, parsed.data.currentId),
  ]);
  if (!previousRow || !currentRow) return apiError('not_found', 'One or both reports were not found.');

  const [previous, current] = await Promise.all([
    getReportJSON<InspectionReport>(ctx.env.REPORTS!, previousRow.r2_key),
    getReportJSON<InspectionReport>(ctx.env.REPORTS!, currentRow.r2_key),
  ]);
  if (!previous || !current) return apiError('not_found', 'Report metadata exists but a stored file is missing.');

  return ok(compareReports(previous, current));
}
