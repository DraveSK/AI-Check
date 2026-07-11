import type { Env } from '../env';
import { apiError } from './http';

/** Every route that touches D1/R2/KV calls this first. Lets the site
 * deploy and serve the dashboard before infrastructure is provisioned
 * (see docs/DEPLOYMENT.md) instead of every request 500ing. */
export function requireBindings<K extends keyof Env>(env: Env, ...keys: K[]): Response | null {
  const missing = keys.filter((k) => env[k] == null);
  if (missing.length > 0) {
    return apiError('not_configured', `This endpoint requires ${missing.join(', ')} to be configured. See docs/DEPLOYMENT.md.`);
  }
  return null;
}
