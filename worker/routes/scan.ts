import type { RouteContext } from '../router';
import { ok } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission } from '../lib/rbac';
import { sha256Hex } from '../lib/crypto';
import { createScanToken } from '../lib/db';
import { checkRateLimit, RATE_LIMITS } from '../lib/ratelimit';
import { apiError } from '../lib/http';
import { log } from '../lib/log';

const SCAN_TOKEN_TTL_MINUTES = 15;

/**
 * POST /api/v1/scan-token — mints the one-time token embedded in the
 * downloadable scan script (see src/components/ScanModal.tsx). Requires
 * a signed-in session with reports.write; the token itself is only good
 * for a single report upload within 15 minutes (see
 * d1/migrations/0003_scan_tokens.sql for why sessions aren't embedded
 * in the download instead).
 */
export async function createScanTokenRoute(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'reports.write');
  if (user instanceof Response) return user;

  const allowed = await checkRateLimit(ctx.env, RATE_LIMITS.upload, user.id);
  if (!allowed) return apiError('rate_limited', 'Too many scan links requested. Try again later.');

  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + SCAN_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  await createScanToken(ctx.env.DB!, await sha256Hex(token), user.id, expiresAt);

  log.info({ category: 'api', event: 'scan_token_created', requestId: ctx.requestId, userId: user.id, status: 201 });
  return ok({ token, expiresAt }, 201);
}
