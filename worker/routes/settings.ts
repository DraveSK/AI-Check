import type { RouteContext } from '../router';
import { apiError, ok } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requirePermission } from '../lib/rbac';
import { safeParseJSON, settingsUpdateSchema } from '../lib/validation';
import { getSettings, upsertSettings, recordAudit } from '../lib/db';

/** GET /api/v1/settings */
export async function getUserSettings(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'settings.read');
  if (user instanceof Response) return user;

  const settings = await getSettings(ctx.env.DB!, user.id);
  return ok({
    preferredAiProvider: settings?.preferred_ai_provider ?? null,
    preferredAiModel: settings?.preferred_ai_model ?? null,
  });
}

/** PUT /api/v1/settings */
export async function updateUserSettings(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requirePermission(ctx.request, ctx.env, 'settings.write');
  if (user instanceof Response) return user;

  const body = await ctx.request.json().catch(() => null);
  const parsed = safeParseJSON(settingsUpdateSchema, body);
  if (!parsed.success) return apiError('invalid_request', 'Invalid settings payload.', parsed.errors);

  await upsertSettings(ctx.env.DB!, user.id, parsed.data.preferredAiProvider ?? null, parsed.data.preferredAiModel ?? null);
  await recordAudit(ctx.env.DB!, user.id, 'settings.updated', { preferredAiProvider: parsed.data.preferredAiProvider ?? null });
  return ok({ saved: true });
}
