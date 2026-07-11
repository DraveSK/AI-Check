import type { Env } from '../env';

/**
 * Fixed-window rate limiting backed by KV — the one genuinely useful KV
 * use case here (see docs/ARCHITECTURE.md §Cloudflare services: not
 * introducing Queues/Turnstile/Images until there's a concrete need).
 *
 * KV writes are eventually consistent, so this is an approximate limit,
 * not a hard guarantee — acceptable for abuse mitigation, not intended
 * as a precise quota system. If `RATE_LIMIT` isn't configured, this is a
 * no-op (fails open) rather than blocking every request — see
 * worker/lib/guard.ts for the pattern used elsewhere for missing bindings.
 */
export interface RateLimitRule {
  key: string; // e.g. `auth:magic-link`
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(env: Env, rule: RateLimitRule, identifier: string): Promise<boolean> {
  if (!env.RATE_LIMIT) return true;
  const window = Math.floor(Date.now() / 1000 / rule.windowSeconds);
  const kvKey = `${rule.key}:${identifier}:${window}`;
  const current = Number((await env.RATE_LIMIT.get(kvKey)) ?? '0');
  if (current >= rule.limit) return false;
  await env.RATE_LIMIT.put(kvKey, String(current + 1), { expirationTtl: rule.windowSeconds * 2 });
  return true;
}

export const RATE_LIMITS = {
  magicLink: { key: 'auth:magic-link', limit: 5, windowSeconds: 60 * 15 },
  upload: { key: 'report:upload', limit: 30, windowSeconds: 60 * 60 },
  analyze: { key: 'ai:analyze', limit: 20, windowSeconds: 60 * 60 },
  publicApi: { key: 'api:general', limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}
