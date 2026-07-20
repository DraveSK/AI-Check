import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui';

/** Minimal magic-link sign-in — reuses existing design tokens (Card,
 * .button, .app) rather than introducing new UI patterns. Only rendered
 * when VITE_PROVIDER_MODE=cloud-api and the session check
 * (useCloudAuth) comes back signed-out. */
export function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/v1/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="app dark login-screen">
      <Card className="login-card">
        <div className="brand">
          <img src="/ai-check-logo.png" alt="AI Check" />
          <span>AI Check</span>
        </div>
        <h1>Sign in</h1>
        <p>We'll email you a one-time sign-in link — no password to remember.</p>

        {state === 'sent' ? (
          <p className="changes-empty">
            <Mail size={16} /> Check {email} for a sign-in link.
          </p>
        ) : (
          <form onSubmit={submit}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button type="submit" className="button primary full-button" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
            {state === 'error' && <p className="login-error">Something went wrong. Try again.</p>}
          </form>
        )}

        <p className="privacy-note">
          <ShieldCheck size={14} /> We only look at folder sizes on your device — never the contents of your files.
        </p>
      </Card>
    </div>
  );
}
