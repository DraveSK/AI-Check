import type { RouteContext } from '../router';
import { apiError, ok } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { requireUser } from '../lib/auth';
import { safeParseJSON, apiKeyUpsertSchema } from '../lib/validation';
import { listApiKeys, upsertApiKey, deleteApiKey, recordAudit } from '../lib/db';
import { encryptSecret } from '../lib/crypto';

/**
 * GET/POST/DELETE /api/v1/providers — manages the user's BYO AI provider
 * keys. The plaintext key is accepted once over HTTPS, encrypted
 * immediately (see worker/lib/crypto.ts), and never returned again in
 * any response — GET only ever returns provider name + creation date.
 * See docs/SECURITY.md §API key handling.
 */
export async function listProviders(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  const keys = await listApiKeys(ctx.env.DB!, user.id);
  return ok(keys.map((k) => ({ provider: k.provider, addedAt: k.created_at })));
}

export async function upsertProvider(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB', 'ENCRYPTION_KEY');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  const body = await ctx.request.json().catch(() => null);
  const parsed = safeParseJSON(apiKeyUpsertSchema, body);
  if (!parsed.success) return apiError('invalid_request', 'provider and apiKey are required.', parsed.errors);

  let ciphertext: string, iv: string;
  try {
    ({ ciphertext, iv } = await encryptSecret(parsed.data.apiKey, ctx.env.ENCRYPTION_KEY!));
  } catch (error) {
    // Surfacing this is safe — the thrown message describes the
    // ENCRYPTION_KEY *configuration* (e.g. wrong length), never any key
    // material — see worker/lib/crypto.ts.
    return apiError('not_configured', error instanceof Error ? error.message : 'ENCRYPTION_KEY is misconfigured.');
  }
  await upsertApiKey(ctx.env.DB!, user.id, parsed.data.provider, ciphertext, iv);
  // Never log the key itself — only that a key was added.
  await recordAudit(ctx.env.DB!, user.id, 'provider.key_added', { provider: parsed.data.provider });

  return ok({ provider: parsed.data.provider, saved: true }, 201);
}

export async function removeProvider(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;
  const user = await requireUser(ctx.request, ctx.env);
  if (user instanceof Response) return user;

  await deleteApiKey(ctx.env.DB!, user.id, ctx.params.provider);
  await recordAudit(ctx.env.DB!, user.id, 'provider.key_removed', { provider: ctx.params.provider });
  return ok({ removed: true });
}
