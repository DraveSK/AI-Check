import type { RouteContext } from '../router';
import type { InspectionReport } from '../../src/types';
import { apiError, ok } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requireUser } from '../lib/auth';
import { safeParseJSON, analyzeRequestSchema } from '../lib/validation';
import { getReport, getApiKey, recordAudit } from '../lib/db';
import { getReportJSON, putAnalysis } from '../lib/r2';
import { decryptSecret } from '../lib/crypto';
import { getAIProvider } from '../lib/ai';
import { checkRateLimit, RATE_LIMITS } from '../lib/ratelimit';
import { log } from '../lib/log';

/**
 * POST /api/v1/analyze — the only endpoint that calls an AI provider.
 * Pipeline: InspectionReport → context (already-decided cleanup items) →
 * AIProvider.explain() → structured result, stored once in R2 as a
 * companion object. See worker/lib/ai/types.ts and
 * docs/SCANNER_DESIGN.md §AI — this route cannot let the AI response
 * alter which items were recommended, only add prose about them.
 */
export async function analyzeReport(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'REPORTS');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  const allowed = await checkRateLimit(ctx.env, RATE_LIMITS.analyze, user.id);
  if (!allowed) return apiError('rate_limited', 'Too many analysis requests. Try again later.');

  const body = await ctx.request.json().catch(() => null);
  const parsed = safeParseJSON(analyzeRequestSchema, body);
  if (!parsed.success) return apiError('invalid_request', 'reportId, provider, and model are required.', parsed.errors);

  const row = await getReport(ctx.env.DB!, user.id, parsed.data.reportId);
  if (!row) return apiError('not_found', 'Report not found.');
  const report = await getReportJSON<InspectionReport>(ctx.env.REPORTS!, row.r2_key);
  if (!report) return apiError('not_found', 'Report metadata exists but the stored file is missing.');

  let apiKey: string | undefined;
  if (parsed.data.provider !== 'ollama') {
    const guardKey = requireBindings(ctx.env, 'ENCRYPTION_KEY');
    if (guardKey) return guardKey;
    const keyRow = await getApiKey(ctx.env.DB!, user.id, parsed.data.provider);
    if (!keyRow) return apiError('invalid_request', `No API key configured for ${parsed.data.provider}. Add one in Settings.`);
    apiKey = await decryptSecret({ ciphertext: keyRow.encrypted_key, iv: keyRow.iv }, ctx.env.ENCRYPTION_KEY!);
  }

  const provider = getAIProvider(parsed.data.provider);
  try {
    const result = await provider.explain({
      device: { platform: report.device.platform, osVersion: report.device.osVersion },
      healthScore: Math.max(0, 100 - report.storage.capacityPercent),
      reclaimableBytes: report.storage.reclaimableBytes,
      cleanupItems: report.cleanup.items,
      model: parsed.data.model,
      apiKey,
    });

    await putAnalysis(ctx.env.REPORTS!, user.id, row.id, result);
    await recordAudit(ctx.env.DB!, user.id, 'report.analyze', { reportId: row.id, provider: parsed.data.provider });

    return ok({
      headline: result.headline,
      summary: result.summary,
      healthScore: Math.max(0, 100 - report.storage.capacityPercent),
      reclaimableBytes: report.storage.reclaimableBytes,
      warningCount: report.security.itemsNeedingReview,
      insights: result.insights,
      model: result.model,
    });
  } catch (error) {
    log.error({ category: 'api', event: 'ai_provider_failed', requestId: ctx.requestId, userId: user.id, provider: parsed.data.provider, error });
    return apiError('upstream_error', `The AI provider request failed. Your recommendations are unaffected — see docs/SCANNER_DESIGN.md §AI.`);
  }
}
