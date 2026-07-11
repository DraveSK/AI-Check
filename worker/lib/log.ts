/**
 * Structured logging. Cloudflare Workers ship stdout to `wrangler tail` /
 * the dashboard's Logs tab automatically — there is no separate logging
 * service to wire up (see docs/ARCHITECTURE.md §Logging, and PRIVACY.md:
 * no telemetry to a third party). This module only shapes the line.
 *
 * Never pass `error`, `metadata`, or any field containing an API key,
 * session token, or file content — see docs/SECURITY.md §Logging.
 */
export type LogCategory = 'app' | 'api' | 'scanner' | 'error';

interface LogFields {
  category: LogCategory;
  event: string;
  requestId?: string;
  userId?: string;
  status?: number;
  durationMs?: number;
  [key: string]: unknown;
}

function write(level: 'info' | 'warn' | 'error', fields: LogFields): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (fields: LogFields) => write('info', fields),
  warn: (fields: LogFields) => write('warn', fields),
  error: (fields: LogFields & { error: unknown }) =>
    write('error', { ...fields, error: fields.error instanceof Error ? fields.error.message : String(fields.error) }),
};

export function newRequestId(): string {
  return crypto.randomUUID();
}
