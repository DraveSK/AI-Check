import { useState } from 'react';
import { Mail, X } from 'lucide-react';

/**
 * The guest → real-account upgrade prompt. Reuses the exact same
 * magic-link endpoints Login.tsx uses — the only difference is this
 * runs while a guest session already exists, so worker/routes/auth.ts
 * verifyMagicLink claims that same account (and its scan history)
 * instead of starting a fresh one. See docs/RBAC.md §Guest accounts.
 */
export function SaveAccountModal({ onClose }: { onClose: () => void }) {
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
        credentials: 'include',
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>Save your results</h2>
        {state === 'sent' ? (
          <p className="changes-empty">
            <Mail size={16} /> Check {email} for a link — click it and everything you've scanned so far stays right where it
            is.
          </p>
        ) : (
          <>
            <p className="modal-copy">
              Add your email and we'll send a one-time link — no password. Your results so far come with you, and future
              scans get saved automatically.
            </p>
            <form onSubmit={submit}>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <button type="submit" className="button primary full-button modal-cta" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
              </button>
              {state === 'error' && <p className="login-error">Something went wrong. Try again.</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
