import { useEffect, useState } from 'react';
import { Card, PageTitle } from '../components/ui';
import { apiFetch } from '../lib/apiFetch';
import { formatBytes } from '../utils/format';

interface PlatformStats {
  totalUsers: number;
  activeUsersLast30Days: number;
  totalReports: number;
  reportsToday: number;
  totalStorageBytes: number;
  scannerVersions: { version: string; count: number }[];
}

/** Admin+ platform-wide counts — never per-user report contents, see
 * worker/routes/analytics.ts. */
export function AnalyticsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PlatformStats>('/api/v1/analytics')
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics.'));
  }, []);

  return (
    <>
      <PageTitle title="Analytics" copy="Platform-wide usage, not any individual user's data." />
      {error && (
        <Card>
          <p className="login-error">{error}</p>
        </Card>
      )}
      {stats && (
        <>
          <div className="stats-grid stats-grid-spaced">
            <div className="changes-stat">
              <span>Total users</span>
              <b>{stats.totalUsers}</b>
            </div>
            <div className="changes-stat">
              <span>Active (30d)</span>
              <b>{stats.activeUsersLast30Days}</b>
            </div>
            <div className="changes-stat">
              <span>Total reports</span>
              <b>{stats.totalReports}</b>
            </div>
            <div className="changes-stat">
              <span>Reports today</span>
              <b>{stats.reportsToday}</b>
            </div>
            <div className="changes-stat">
              <span>Storage tracked</span>
              <b>{formatBytes(stats.totalStorageBytes)}</b>
            </div>
          </div>

          <Card>
            <div className="card-head">
              <div>
                <h2>Scanner versions</h2>
                <p>Reports grouped by scanner version</p>
              </div>
            </div>
            {stats.scannerVersions.map((v) => (
              <div className="row" key={v.version}>
                <span className="file">{v.version}</span>
                <span className="row-sub">{v.count} reports</span>
              </div>
            ))}
            {stats.scannerVersions.length === 0 && <p className="changes-empty">No reports yet.</p>}
          </Card>
        </>
      )}
    </>
  );
}
