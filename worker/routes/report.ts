import type { RouteContext } from '../router';
import type { InspectionReport } from '../../src/types';
import { apiError, ok, pick } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission, hasPermission, type Role } from '../lib/rbac';
import { safeParseJSON, inspectionReportSchema, compareQuerySchema } from '../lib/validation';
import { sha256Hex } from '../lib/crypto';
import { upsertDevice, insertReport, getReport, listReports, recordAudit, consumeScanToken, type ReportRow, type UserRow } from '../lib/db';
import { putReport, getReportJSON } from '../lib/r2';
import { checkRateLimit, RATE_LIMITS } from '../lib/ratelimit';
import { compareReports } from '../../src/utils/compareReports';
import { log } from '../lib/log';

const REPORT_LIST_FIELDS = ['id', 'device_id', 'schema_version', 'scanner_version', 'used_bytes', 'total_bytes', 'reclaimable_bytes', 'collected_at', 'created_at'] as const;

/** `?userId=` lets an admin/super_admin look at another user's reports —
 * see docs/RBAC.md §Ownership rules. A plain `user` passing this
 * parameter is silently ignored (falls back to their own id), never an
 * error — the parameter simply has no effect without the permission. */
function resolveTargetUserId(request: Request, requester: { id: string; role: string }): { userId: string; asAdmin: boolean } {
  const requested = new URL(request.url).searchParams.get('userId');
  const isAdmin = requester.role === 'admin' || requester.role === 'super_admin';
  if (requested && isAdmin) return { userId: requested, asAdmin: true };
  return { userId: requester.id, asAdmin: false };
}

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

  // Two ways in: a normal session (cookie/Bearer, the scanner CLI path)
  // or a one-time X-Scan-Token minted by POST /api/v1/scan-token for the
  // browser's downloadable scan script. The token is burned on first
  // use, so a leaked download can't upload twice.
  let user: UserRow;
  const scanToken = ctx.request.headers.get('X-Scan-Token');
  if (scanToken) {
    const resolved = await consumeScanToken(ctx.env.DB!, await sha256Hex(scanToken));
    if (!resolved) return apiError('unauthorized', 'This scan link has expired or was already used. Download a fresh one from the dashboard.');
    if (resolved.status === 'disabled' || !hasPermission(resolved.role as Role, 'reports.write')) {
      return apiError('forbidden', 'This account cannot upload reports.');
    }
    user = resolved;
  } else {
    const resolved = await requirePermission(ctx.request, ctx.env, 'reports.write');
    if (resolved instanceof Response) return resolved;
    user = resolved;
  }

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

/** GET /api/v1/report/:id — a single full report. Admins may pass
 * `?userId=` to view another user's report (see resolveTargetUserId). */
export async function getReportById(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'REPORTS');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'reports.read');
  if (user instanceof Response) return user;

  const { asAdmin } = resolveTargetUserId(ctx.request, user);
  const row = await getReport(ctx.env.DB!, user.id, ctx.params.id, asAdmin);
  if (!row) return apiError('not_found', 'Report not found.');
  const report = await getReportJSON<InspectionReport>(ctx.env.REPORTS!, row.r2_key);
  if (!report) return apiError('not_found', 'Report metadata exists but the stored file is missing.');
  return ok(report);
}

/** GET /api/v1/report/history?deviceId=&userId= — lightweight summaries,
 * never full reports, matching the pattern already established for the
 * local scanner's history index (see docs/HISTORY_FORMAT.md). */
export async function reportHistory(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'reports.read');
  if (user instanceof Response) return user;

  const { userId, asAdmin } = resolveTargetUserId(ctx.request, user);
  const deviceId = new URL(ctx.request.url).searchParams.get('deviceId') ?? undefined;
  const rows = await listReports(ctx.env.DB!, userId, deviceId, 100, asAdmin);
  return ok(rows.map((r) => pick(r, REPORT_LIST_FIELDS)));
}

/** GET /api/v1/report/compare?previousId=&currentId= — reuses the exact
 * same compareReports() the local dashboard and scanner CLI use (see
 * src/utils/compareReports.ts and docs/HISTORY_FORMAT.md) — one
 * implementation, now three call sites. */
export async function compareReportsRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'REPORTS');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'reports.read');
  if (user instanceof Response) return user;

  const url = new URL(ctx.request.url);
  const parsed = safeParseJSON(compareQuerySchema, { previousId: url.searchParams.get('previousId'), currentId: url.searchParams.get('currentId') });
  if (!parsed.success) return apiError('invalid_request', 'previousId and currentId are required.', parsed.errors);

  const { asAdmin } = resolveTargetUserId(ctx.request, user);
  const [previousRow, currentRow] = await Promise.all([
    getReport(ctx.env.DB!, user.id, parsed.data.previousId, asAdmin),
    getReport(ctx.env.DB!, user.id, parsed.data.currentId, asAdmin),
  ]);
  if (!previousRow || !currentRow) return apiError('not_found', 'One or both reports were not found.');

  const [previous, current] = await Promise.all([
    getReportJSON<InspectionReport>(ctx.env.REPORTS!, previousRow.r2_key),
    getReportJSON<InspectionReport>(ctx.env.REPORTS!, currentRow.r2_key),
  ]);
  if (!previous || !current) return apiError('not_found', 'Report metadata exists but a stored file is missing.');

  return ok(compareReports(previous, current));
}
