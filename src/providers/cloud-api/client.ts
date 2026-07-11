/** Thin fetch wrapper for the hosted API — see docs/API.md. Every call
 * sends the session cookie (`credentials: 'include'`); auth failures
 * surface as a thrown error the caller turns into `ProviderResult.status
 * = 'error'`, exactly like any other provider failure. */

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
