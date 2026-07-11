import type { Env } from '../env';
import { sha256Hex } from './crypto';
import { findSessionUser, type UserRow } from './db';
import { apiError } from './http';

const SESSION_COOKIE = 'ai_check_session';
const SESSION_TTL_DAYS = 30;

export function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function sessionCookie(token: string, expires: string): string {
  // HttpOnly: never readable from JS. Secure: HTTPS only. SameSite=Lax:
  // sent on top-level navigation (the magic-link redirect) but not on
  // cross-site requests — see docs/SECURITY.md §Session cookies.
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${new Date(expires).toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

/** The browser uses the HttpOnly cookie; the scanner CLI (which has no
 * cookie jar) sends the same opaque session token as a Bearer header
 * instead — see scanner/upload.ts. Both resolve through the exact same
 * `sessions` table lookup, just a different transport. */
function readSessionToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  return readCookie(request, SESSION_COOKIE);
}

/** Resolves the signed-in user from the session cookie or Bearer token,
 * or null. Never throws — an invalid/expired session is just "not
 * signed in." */
export async function currentUser(request: Request, env: Env): Promise<UserRow | null> {
  if (!env.DB) return null;
  const token = readSessionToken(request);
  if (!token) return null;
  const hash = await sha256Hex(token);
  return findSessionUser(env.DB, hash);
}

/** Route-level helper: resolves the user or returns a 401 Response ready
 * to hand straight back to the caller — see worker/routes/*.ts for the
 * `const user = await requireUser(...); if (user instanceof Response) return user;`
 * pattern used at the top of every protected route. */
export async function requireUser(request: Request, env: Env): Promise<UserRow | Response> {
  const user = await currentUser(request, env);
  if (!user) return apiError('unauthorized', 'Sign in required.');
  return user;
}
