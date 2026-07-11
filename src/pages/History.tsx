import { useState } from 'react';
import { Check, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';
import { formatBytes } from '../utils/format';
import { computeHistoryStats, timeSince } from '../utils/compareReports';
import { exportComparison, exportHistory, type ExportFormat } from '../utils/exportReport';
import type { ComparisonResult, FolderDelta, HistoryEntry } from '../types';

function DiffRow({ delta, tone }: { delta: FolderDelta; tone: 'growth' | 'recovered' | 'gray' }) {
  const sign = delta.deltaBytes > 0 ? '+' : delta.deltaBytes < 0 ? '-' : '';
  return (
    <div className={'diff-row ' + tone}>
      <span className="file">{delta.label}</span>
      <span className="before">{formatBytes(delta.previousBytes)}</span>
      <span className="after">{formatBytes(delta.currentBytes)}</span>
      <span className={'delta ' + tone}>{sign}{formatBytes(Math.abs(delta.deltaBytes))}</span>
    </div>
  );
}

function ComparisonView({ result }: { result: ComparisonResult }) {
  return (
    <Card>
      <div className="card-head">
        <div>
          <h2>Before → After</h2>
          <p>
            {new Date(result.previous.collectedAt).toLocaleDateString()} → {new Date(result.current.collectedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="export-row">
          {(['json', 'markdown', 'html'] as ExportFormat[]).map((format) => (
            <button key={format} className="ghost" onClick={() => exportComparison(result, format)}>
              <Download size={14} /> {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {result.insights.map((insight) => (
        <p key={insight.id} className={'insight-line ' + insight.tone}>
          {insight.message}
        </p>
      ))}

      <div className="diff-row header">
        <span className="file">Folder</span>
        <span className="before">Before</span>
        <span className="after">After</span>
        <span className="delta">Change</span>
      </div>
      {result.newFolders.map((f) => (
        <div className="diff-row growth" key={'new-' + f.path}>
          <span className="file">{f.label} (new)</span>
          <span className="before">—</span>
          <span className="after">{formatBytes(f.bytes)}</span>
          <span className="delta growth">+{formatBytes(f.bytes)}</span>
        </div>
      ))}
      {result.grown.map((d) => (
        <DiffRow key={'grown-' + d.path} delta={d} tone="growth" />
      ))}
      {result.shrunk.map((d) => (
        <DiffRow key={'shrunk-' + d.path} delta={d} tone="recovered" />
      ))}
      {result.removedFolders.map((f) => (
        <div className="diff-row recovered" key={'removed-' + f.path}>
          <span className="file">{f.label} (removed)</span>
          <span className="before">{formatBytes(f.bytes)}</span>
          <span className="after">—</span>
          <span className="delta recovered">-{formatBytes(f.bytes)}</span>
        </div>
      ))}
      {result.unchanged.map((d) => (
        <DiffRow key={'unchanged-' + d.path} delta={d} tone="gray" />
      ))}
    </Card>
  );
}

function ComparePicker({ entries, previousId, currentId, onChange }: { entries: HistoryEntry[]; previousId: string; currentId: string; onChange: (previousId: string, currentId: string) => void }) {
  return (
    <div className="compare-picker">
      <span className="row-sub">Compare</span>
      <select value={previousId} onChange={(e) => onChange(e.target.value, currentId)}>
        {entries.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {new Date(entry.inspectedAt).toLocaleString()}
          </option>
        ))}
      </select>
      <span className="row-sub">→</span>
      <select value={currentId} onChange={(e) => onChange(previousId, e.target.value)}>
        {entries.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {new Date(entry.inspectedAt).toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}

export function HistoryPage() {
  const providers = useProviders();
  const history = useProviderData(() => providers.history.getHistory('active'));
  const [selection, setSelection] = useState<{ previousId: string; currentId: string } | null>(null);

  const entries = history.data ?? [];
  const active =
    selection ?? (entries.length >= 2 ? { previousId: entries[1].id, currentId: entries[0].id } : null);

  const comparison = useProviderData(async () => {
    if (!active) return { status: 'empty' as const, data: null, source: 'local-scanner' as const };
    return providers.history.getComparison(active.previousId, active.currentId);
  }, [active?.previousId, active?.currentId]);

  const stats = computeHistoryStats(entries);

  return (
    <>
      <PageTitle title="Scan History" copy="Review how your storage has changed over time, and compare any two scans." />

      <ProviderGate result={history} emptyLabel="This is your first scan. Run npm run scan again later to see what changed.">
        {() => (
          <>
            <Card>
              <div className="card-head">
                <div>
                  <h2>Cleanup statistics</h2>
                  <p>Across every scan on this device</p>
                </div>
                <button className="ghost" onClick={() => exportHistory(entries, 'json')}>
                  <Download size={14} /> Export history
                </button>
              </div>
              <div className="stats-grid">
                <div className="changes-stat">
                  <span>Total recovered</span>
                  <b className="recovered">{formatBytes(stats.totalRecoveredBytes)}</b>
                </div>
                <div className="changes-stat">
                  <span>Largest cleanup ever</span>
                  <b className="recovered">{formatBytes(stats.largestCleanupEverBytes)}</b>
                </div>
                <div className="changes-stat">
                  <span>Average recovery</span>
                  <b>{formatBytes(stats.averageRecoveryBytes)}</b>
                </div>
                <div className="changes-stat">
                  <span>Storage trend</span>
                  <b className={stats.trend === 'growing' ? 'growth' : stats.trend === 'shrinking' ? 'recovered' : ''}>
                    {stats.trend === 'growing' ? <TrendingUp size={13} /> : stats.trend === 'shrinking' ? <TrendingDown size={13} /> : null} {stats.trend}
                  </b>
                </div>
                <div className="changes-stat">
                  <span>Scans recorded</span>
                  <b>{stats.scanCount}</b>
                </div>
              </div>
            </Card>

            {entries.length < 2 ? (
              <Card>
                <p className="changes-empty">
                  {entries.length === 1
                    ? 'This is your first scan. Run npm run scan again later to compare.'
                    : 'No scans yet.'}
                </p>
              </Card>
            ) : (
              active && (
                <>
                  <Card>
                    <ComparePicker
                      entries={entries}
                      previousId={active.previousId}
                      currentId={active.currentId}
                      onChange={(previousId, currentId) => setSelection({ previousId, currentId })}
                    />
                  </Card>
                  <ProviderGate result={comparison} emptyLabel="Comparison unavailable — one of these scans may have aged out of local storage.">
                    {(result) => <ComparisonView result={result} />}
                  </ProviderGate>
                </>
              )
            )}

            <Card className="folder-card">
              <div className="card-head">
                <div>
                  <h2>Timeline</h2>
                  <p>Every scan recorded on this device</p>
                </div>
                <Pill tone="green">{entries.length} scans</Pill>
              </div>
              {entries.map((entry) => (
                <div className="row" key={entry.id}>
                  <span className="file">
                    <span className="row-icon">
                      <Check size={15} />
                    </span>
                    {new Date(entry.inspectedAt).toLocaleString()}
                  </span>
                  <span className="row-sub">{entry.usedBytes ? formatBytes(entry.usedBytes) : '—'} used</span>
                  <span className="row-sub">{entry.largestFolderLabel ?? '—'}</span>
                  <Pill tone={entry.changeBytes == null ? 'neutral' : entry.changeBytes > 0 ? 'orange' : 'green'}>
                    {entry.changeBytes == null ? 'First scan' : `${entry.changeBytes > 0 ? '+' : ''}${formatBytes(entry.changeBytes)}`}
                  </Pill>
                  <span className="row-sub">{timeSince(entry.inspectedAt)}</span>
                </div>
              ))}
            </Card>
          </>
        )}
      </ProviderGate>
    </>
  );
}
