import { createInterface } from 'node:readline/promises';
import { saveSession } from './session.js';

const DEFAULT_API_URL = process.env.AI_CHECK_API_URL ?? 'https://check.drave.sk';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(question).finally(() => rl.close());
}

/**
 * `npm run login -- you@email.com` — requests a magic link, then asks you
 * to paste the token from the emailed link (or the dev-mode console log,
 * if RESEND_API_KEY isn't configured server-side — see worker/lib/email.ts).
 * Saves the resulting session to ~/.ai-check/session.json for
 * `npm run scan -- --upload` to use. See docs/DEPLOYMENT.md and
 * docs/API.md.
 */
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run login -- you@email.com');
    process.exit(1);
  }

  const apiUrl = DEFAULT_API_URL.replace(/\/$/, '');
  console.log(`Requesting a sign-in link for ${email} from ${apiUrl}...`);

  const res = await fetch(`${apiUrl}/api/v1/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    console.error('Failed to request a sign-in link:', body ?? res.status);
    process.exit(1);
  }

  console.log('Check your email for a sign-in link.');
  const pasted = await prompt('Paste the full link or just the token from it: ');
  const token = pasted.includes('token=') ? new URL(pasted).searchParams.get('token') ?? '' : pasted.trim();
  if (!token) {
    console.error('No token provided.');
    process.exit(1);
  }

  const verifyRes = await fetch(`${apiUrl}/api/v1/auth/verify?token=${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => null);
    console.error('Sign-in failed:', body ?? verifyRes.status);
    process.exit(1);
  }
  const { data } = (await verifyRes.json()) as { data: { sessionToken: string; expiresAt: string; email: string } };

  await saveSession({ apiUrl, sessionToken: data.sessionToken, email: data.email, expiresAt: data.expiresAt });
  console.log(`Signed in as ${data.email}. Run \`npm run scan -- --upload\` to upload your next scan.`);
}

main().catch((error) => {
  console.error('Login failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
