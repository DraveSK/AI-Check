import type { InspectionReport } from '../src/types';
import { loadSession } from './session.js';

/**
 * Uploads a report to the API (see worker/routes/report.ts). Local-first
 * remains the default — this only runs when `npm run scan -- --upload` is
 * passed explicitly (see cli.ts) and a signed-in session exists (see
 * login.ts). Nothing is ever uploaded implicitly. See PRIVACY.md
 * "Local-first by default."
 */
export async function uploadReport(report: InspectionReport): Promise<{ id: string } | null> {
  const session = await loadSession();
  if (!session) {
    console.log('Not signed in — skipping upload. Run `npm run login -- you@email.com` first.');
    return null;
  }

  const res = await fetch(`${session.apiUrl}/api/v1/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.sessionToken}` },
    body: JSON.stringify(report),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    console.error(`Upload failed (${res.status}):`, body ?? '');
    return null;
  }

  const { data } = (await res.json()) as { data: { id: string } };
  return data;
}
