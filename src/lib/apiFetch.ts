/** Thin fetch wrapper for the hosted API — see docs/API.md. Every call
 * sends the session cookie (`credentials: 'include'`); failures throw so
 * callers can turn them into whatever their context needs (a
 * `ProviderResult.status = 'error'` in providers, a plain caught error in
 * a page's local state — see src/pages/Settings.tsx, src/pages/Users.tsx,
 * etc.). One implementation, every admin/settings page and the
 * cloud-api provider registry share it — see docs/RBAC.md "reuse existing
 * architecture." */

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body || body.error) {
    throw new Error(body?.error?.message ?? `Request to ${path} failed (${res.status}).`);
  }
  return body.data as T;
}
