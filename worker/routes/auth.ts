import type { RouteContext } from '../router';
import { apiError, ok } from '../lib/http';
import { requireBindings } from '../lib/guard';
import { safeParseJSON, magicLinkRequestSchema, magicLinkVerifySchema } from '../lib/validation';
import { randomToken, sha256Hex } from '../lib/crypto';
import { createMagicLink, consumeMagicLink, findOrCreateUser, createGuestUser, upgradeGuestUser, createSession, deleteSession, recordAudit, updateLastLogin } from '../lib/db';
import { sessionCookie, sessionExpiry, clearSessionCookie, currentUser } from '../lib/auth';
import { sendMagicLinkEmail } from '../lib/email';
import { checkRateLimit, RATE_LIMITS, clientIp } from '../lib/ratelimit';
import { permissionsForRole, type Role } from '../lib/rbac';
import { log } from '../lib/log';
import { pick } from '../lib/http';

const MAGIC_LINK_TTL_MINUTES = 15;

/** POST /api/v1/auth/magic-link — request a sign-in link. Always returns
 * 200 regardless of whether the email is new or existing, so this
 * endpoint can't be used to enumerate registered users. */
export async function requestMagicLink(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;

  const allowed = await checkRateLimit(ctx.env, RATE_LIMITS.magicLink, clientIp(ctx.request));
  if (!allowed) return apiError('rate_limited', 'Too many sign-in attempts. Try again in a few minutes.');

  const body = await ctx.request.json().catch(() => null);
  const parsed = safeParseJSON(magicLinkRequestSchema, body);
  if (!parsed.success) return apiError('invalid_request', 'Invalid email.', parsed.errors);

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000).toISOString();
  await createMagicLink(ctx.env.DB!, parsed.data.email, tokenHash, expiresAt);

  const appUrl = ctx.env.APP_URL ?? new URL(ctx.request.url).origin;
  const magicLinkUrl = `${appUrl}/api/v1/auth/verify?token=${token}`;

  try {
    await sendMagicLinkEmail(ctx.env, parsed.data.email, magicLinkUrl);
  } catch (error) {
    log.error({ category: 'api', event: 'magic_link_send_failed', requestId: ctx.requestId, error });
    // Don't leak delivery failures to the client beyond a generic message
    // — avoids confirming whether the address is real, and avoids
    // exposing email-provider internals.
  }

  return ok({ sent: true });
}

/** POST /api/v1/auth/guest — silently provisions an unclaimed guest
 * account and session so a first-time visitor can scan and see results
 * before ever giving an email (see worker/lib/db.ts createGuestUser and
 * docs/RBAC.md §Guest accounts). Rate limited by IP like the real
 * sign-in flow — this still writes a row per call. */
export async function guestSignIn(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;

  const allowed = await checkRateLimit(ctx.env, RATE_LIMITS.magicLink, clientIp(ctx.request));
  if (!allowed) return apiError('rate_limited', 'Too many attempts. Try again in a few minutes.');

  const user = await createGuestUser(ctx.env.DB!);
  const sessionToken = randomToken();
  const sessionHash = await sha256Hex(sessionToken);
  const expiresAt = sessionExpiry();
  await createSession(ctx.env.DB!, sessionHash, user.id, expiresAt);

  return new Response(JSON.stringify({ data: { guest: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(sessionToken, expiresAt) },
  });
}

/** GET /api/v1/auth/verify?token=... — consumes the token, creates a
 * session, and sets the HttpOnly cookie. If the browser already has a
 * guest session, this claims that same account (keeping its scan
 * history) instead of starting a fresh one — see upgradeGuestUser. */
export async function verifyMagicLink(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;

  const url = new URL(ctx.request.url);
  const parsed = safeParseJSON(magicLinkVerifySchema, { token: url.searchParams.get('token') });
  if (!parsed.success) return apiError('invalid_request', 'Missing or malformed token.', parsed.errors);

  const tokenHash = await sha256Hex(parsed.data.token);
  const consumed = await consumeMagicLink(ctx.env.DB!, tokenHash);
  if (!consumed) return apiError('unauthorized', 'This sign-in link is invalid, expired, or already used.');

  const guest = await currentUser(ctx.request, ctx.env);
  const user =
    guest && guest.is_guest ? await upgradeGuestUser(ctx.env.DB!, guest.id, consumed.email) : await findOrCreateUser(ctx.env.DB!, consumed.email);
  if (user.status === 'disabled') {
    await recordAudit(ctx.env.DB!, user.id, 'auth.sign_in_blocked', { reason: 'disabled' });
    return apiError('forbidden', 'This account has been disabled.');
  }

  const sessionToken = randomToken();
  const sessionHash = await sha256Hex(sessionToken);
  const expiresAt = sessionExpiry();
  await createSession(ctx.env.DB!, sessionHash, user.id, expiresAt);
  await updateLastLogin(ctx.env.DB!, user.id);
  await recordAudit(ctx.env.DB!, user.id, 'auth.sign_in');

  // Two callers hit this same endpoint: a browser following the emailed
  // link (wants a redirect + cookie) and the scanner CLI, which has no
  // cookie jar and calls this directly with the pasted token (wants the
  // raw session token back as JSON) — see scanner/login.ts.
  if (ctx.request.headers.get('Accept')?.includes('application/json')) {
    return ok({ sessionToken, expiresAt, email: consumed.email });
  }

  const appUrl = ctx.env.APP_URL ?? url.origin;
  return new Response(null, {
    status: 302,
    headers: { Location: `${appUrl}/`, 'Set-Cookie': sessionCookie(sessionToken, expiresAt) },
  });
}

/** POST /api/v1/auth/logout */
export async function logout(ctx: RouteContext): Promise<Response> {
  const guard = requireBindings(ctx.env, 'DB');
  if (guard) return guard;

  const header = ctx.request.headers.get('Cookie') ?? '';
  const match = /ai_check_session=([^;]+)/.exec(header);
  if (match) {
    const user = await currentUser(ctx.request, ctx.env);
    await deleteSession(ctx.env.DB!, await sha256Hex(match[1]));
    if (user) await recordAudit(ctx.env.DB!, user.id, 'auth.sign_out');
  }

  return new Response(JSON.stringify({ data: { signedOut: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie() },
  });
}

/** GET /api/v1/auth/me — the currently signed-in user, or 401. Includes
 * `permissions` (derived from `role`, see worker/lib/rbac.ts) so the
 * frontend never has to duplicate the role→permission mapping to decide
 * what to show — it just checks `permissions.includes('users.read')`. */
export async function me(ctx: RouteContext): Promise<Response> {
  const user = await currentUser(ctx.request, ctx.env);
  if (!user) return apiError('unauthorized', 'Not signed in.');
  return ok({
    ...pick(user, ['id', 'email', 'display_name', 'avatar', 'role', 'status', 'created_at', 'last_login']),
    isGuest: Boolean(user.is_guest),
    permissions: permissionsForRole(user.role as Role),
  });
}
