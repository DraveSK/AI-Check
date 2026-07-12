import { useEffect, useState } from 'react';
import { Card, PageTitle } from '../components/ui';
import { apiFetch } from '../lib/apiFetch';

interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  metadata: string | null;
  created_at: string;
}

/** Admin+ read-only log viewer. `metadata` is guaranteed secret-free at
 * write time (see worker/lib/db.ts recordAudit callers, and
 * docs/SECURITY.md §Logging) — this page renders it as-is. */
export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuditLogRow[]>('/api/v1/audit-logs')
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load audit logs.'));
  }, []);

  return (
    <>
      <PageTitle title="Audit Logs" copy="Every sign-in, upload, and admin action — never passwords, keys, or private data." />
      <Card>
        <div className="card-head">
          <div>
            <h2>Recent activity</h2>
            <p>{logs?.length ?? '—'} entries</p>
          </div>
        </div>
        {error && <p className="login-error">{error}</p>}
        {logs?.map((log) => (
          <div className="row" key={log.id}>
            <span className="file">{log.action}</span>
            <span className="row-sub">{log.user_id ?? 'system'}</span>
            <span className="row-sub">{log.metadata ?? ''}</span>
            <span className="row-sub">{new Date(log.created_at).toLocaleString()}</span>
          </div>
        ))}
        {logs?.length === 0 && <p className="changes-empty">No activity recorded yet.</p>}
      </Card>
    </>
  );
}
