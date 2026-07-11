import type { Env } from '../env';
import { log } from './log';

/**
 * Sends the magic-link sign-in email. Deliberately not tied to a specific
 * provider — Resend is used because it has a simple HTTP API with no SDK
 * dependency needed, but swapping it means editing this one function, not
 * the auth route (see worker/routes/auth.ts).
 *
 * If `RESEND_API_KEY` isn't configured, the link is logged instead of
 * emailed — this is what makes local development and a fresh deploy work
 * without an email provider on day one. See docs/DEPLOYMENT.md.
 */
export async function sendMagicLinkEmail(env: Env, email: string, magicLinkUrl: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    log.info({ category: 'app', event: 'magic_link_dev_mode', email, url: magicLinkUrl });
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? 'AI Check <login@check.drave.sk>',
      to: email,
      subject: 'Sign in to AI Check',
      html: `<p>Click to sign in — this link expires in 15 minutes and can only be used once.</p><p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to send magic link email (${res.status}): ${body}`);
  }
}
