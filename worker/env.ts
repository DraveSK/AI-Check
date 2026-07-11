/**
 * Cloudflare bindings for the Worker. Every binding except ASSETS is
 * optional at the type level because the site must keep serving the
 * dashboard even before D1/R2/KV are provisioned — see
 * docs/DEPLOYMENT.md. Routes that need a binding check for it explicitly
 * (worker/lib/guard.ts) and return 501 rather than crashing.
 */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: D1Database;
  REPORTS?: R2Bucket;
  RATE_LIMIT?: KVNamespace;

  /** 32-byte key, base64-encoded. `wrangler secret put ENCRYPTION_KEY`.
   * Used to encrypt stored BYO AI provider keys — see worker/lib/crypto.ts. */
  ENCRYPTION_KEY?: string;

  /** Optional — if unset, magic links are logged instead of emailed (dev
   * mode). See worker/lib/email.ts. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;

  /** Public origin used to build magic-link URLs, e.g. https://check.drave.sk */
  APP_URL?: string;
}
