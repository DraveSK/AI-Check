import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'ai-check-privacy-ack';

/**
 * A GDPR-style consent notice, not a cookie banner — this app sets no
 * tracking cookies, but running a scan does send storage metadata
 * (folder names/sizes, never file contents) to this server under an
 * anonymous session (see docs/RBAC.md §Guest accounts), which is
 * personal data under GDPR's broad definition even without an email
 * attached. Shown once per browser before that can happen; the
 * acknowledgment is stored locally, not sent anywhere.
 */
export function PrivacyNotice() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  function acknowledge() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  }

  return (
    <div className="privacy-banner">
      <div className="privacy-banner-inner">
        <ShieldCheck size={20} className="privacy-banner-icon" />
        <div className="privacy-banner-body">
          <p>
            <b>Before you scan:</b> AI Check looks at folder sizes and names on your device — never file contents. When
            you run an inspection, that summary is sent to our server and stored under an anonymous, temporary session
            (no name, no email, no account) so you can see the results in this browser. It isn't shared with anyone
            else or used for advertising.
          </p>
          {expanded && (
            <div className="privacy-banner-detail">
              <p>
                <b>What we collect:</b> folder names and sizes, disk usage totals, installed developer tools, and basic
                system info (OS version, device model) — the same data you'd see in macOS's own Storage settings.
              </p>
              <p>
                <b>What we never collect:</b> the contents of your files, passwords, or the values of any keys/secrets
                — the Security Analyzer only reports that a sensitive file exists and where, never what's inside it.
              </p>
              <p>
                <b>Where it's stored:</b> Cloudflare's infrastructure, tied to a random anonymous session id in your
                browser's cookies — not to your name or email unless you separately choose to sign in.
              </p>
              <p>
                <b>How long:</b> until you clear your browser's cookies for this site, or request deletion.
              </p>
              <p>
                <b>Your rights:</b> you can request a copy or deletion of anything stored under your session at any
                time — see <a href="https://github.com/DraveSK/AI-Check/blob/main/docs/PRIVACY.md" target="_blank" rel="noreferrer">the full privacy policy</a> for how.
              </p>
            </div>
          )}
          <div className="privacy-banner-actions">
            <button className="ghost" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : 'Read the details'}
            </button>
            <button className="button primary" onClick={acknowledge}>
              I understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
