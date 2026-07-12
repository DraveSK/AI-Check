import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { apiFetch } from '../lib/apiFetch';

interface SystemStatus {
  bindings: { DB: boolean; REPORTS: boolean; RATE_LIMIT: boolean };
  secrets: { ENCRYPTION_KEY: boolean; BREVO_API_KEY: boolean; EMAIL_FROM: boolean; APP_URL: boolean };
}

function StatusRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="row">
      <span className="file">
        <span className="row-icon">{ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}</span>
        {label}
      </span>
      <span className="row-sub">{note}</span>
      <Pill tone={ok ? 'green' : 'orange'}>{ok ? 'Configured' : 'Not configured'}</Pill>
    </div>
  );
}

/**
 * super_admin only. Consolidates what the original nav spec listed as
 * eight separate items (Cloudflare, AI Providers, Database, Workers,
 * Deployment, Secrets, System Health, Platform) into ONE page — see
 * docs/RBAC.md §Navigation for why: none of those are things this app
 * should let you edit through its own UI (see docs/SECURITY.md §API key
 * handling for why ENCRYPTION_KEY specifically can never have an in-app
 * editor), so eight nav entries would mostly duplicate links to the
 * Cloudflare dashboard, which already has a perfectly good UI for
 * exactly this. This page is read-only status + the actual links.
 */
export function PlatformPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SystemStatus>('/api/v1/system')
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load system status.'));
  }, []);

  return (
    <>
      <PageTitle title="Platform" copy="Infrastructure status. Managed in the Cloudflare dashboard, never here — see docs/DEPLOYMENT.md." />
      {error && (
        <Card>
          <p className="login-error">{error}</p>
        </Card>
      )}
      {status && (
        <>
          <Card>
            <div className="card-head">
              <div>
                <h2>Bindings</h2>
                <p>Database, Workers</p>
              </div>
            </div>
            <StatusRow label="D1 database" ok={status.bindings.DB} note="Reports, users, sessions" />
            <StatusRow label="R2 bucket" ok={status.bindings.REPORTS} note="Report storage" />
            <StatusRow label="KV namespace" ok={status.bindings.RATE_LIMIT} note="Rate limiting" />
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <h2>Secrets</h2>
                <p>AI Providers, Deployment — values are never shown here, only whether each is set</p>
              </div>
            </div>
            <StatusRow label="ENCRYPTION_KEY" ok={status.secrets.ENCRYPTION_KEY} note="Encrypts BYO AI keys" />
            <StatusRow label="BREVO_API_KEY" ok={status.secrets.BREVO_API_KEY} note="Magic-link email delivery" />
            <StatusRow label="EMAIL_FROM" ok={status.secrets.EMAIL_FROM} />
            <StatusRow label="APP_URL" ok={status.secrets.APP_URL} />
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <h2>Manage infrastructure</h2>
                <p>Cloudflare, Database, Workers, Deployment, Secrets</p>
              </div>
            </div>
            <a className="full-button" href="https://dash.cloudflare.com" target="_blank" rel="noreferrer">
              Open Cloudflare dashboard <ExternalLink size={15} />
            </a>
          </Card>
        </>
      )}
    </>
  );
}
