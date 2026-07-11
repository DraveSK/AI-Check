/** Consistent JSON envelope for every API response — see docs/API.md. */
export function ok<T>(data: T, status = 200, extraHeaders?: HeadersInit): Response {
  return Response.json({ data, meta: { generatedAt: new Date().toISOString() } }, { status, headers: extraHeaders });
}

export type ApiErrorCode =
  | 'invalid_request'
  | 'invalid_report'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'not_configured'
  | 'rate_limited'
  | 'upstream_error'
  | 'internal_error';

const STATUS_FOR: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  invalid_report: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  not_configured: 501,
  rate_limited: 429,
  upstream_error: 502,
  internal_error: 500,
};

export function apiError(code: ApiErrorCode, message: string, details?: unknown): Response {
  return Response.json({ error: { code, message, details } }, { status: STATUS_FOR[code] });
}

/** Never expose internal models to the client — this whitelist is the one
 * place a route decides what a user is allowed to see back. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) result[key] = obj[key];
  return result;
}
