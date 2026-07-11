import type { Env } from '../env';
import { log } from './log';

/**
 * Sends the magic-link sign-in email. Deliberately not tied to a specific
 * provider — Brevo (formerly Sendinblue) is used because its free tier
 * (300 emails/day) covers this app's volume and it has a simple HTTP API
 * with no SDK dependency needed, but swapping it means editing this one
 * function, not the auth route (see worker/routes/auth.ts).
 *
 * If `BREVO_API_KEY` isn't configured, the link is logged instead of
 * emailed — this is what makes local development and a fresh deploy work
 * without an email provider on day one. See docs/DEPLOYMENT.md.
 */
export async function sendMagicLinkEmail(env: Env, email: string, magicLinkUrl: string): Promise<void> {
  if (!env.BREVO_API_KEY) {
    log.info({ category: 'app', event: 'magic_link_dev_mode', email, url: magicLinkUrl });
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: parseEmailFrom(env.EMAIL_FROM),
      to: [{ email }],
      subject: 'Sign in to AI Check',
      htmlContent: `<p>Click to sign in — this link expires in 15 minutes and can only be used once.</p><p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to send magic link email (${res.status}): ${body}`);
  }
}

/** `EMAIL_FROM` is stored as `"Name <email@domain>"` (matches the format
 * other providers like Resend use) — Brevo's API wants `{name, email}`
 * split out, so this parses the one stored string into that shape. */
function parseEmailFrom(emailFrom: string | undefined): { name: string; email: string } {
  const match = /^(.*)<(.+)>$/.exec(emailFrom ?? '');
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: 'AI Check', email: emailFrom ?? 'login@check.drave.sk' };
}
