import { useState } from 'react';
import { Activity, Archive, ArrowUpRight, Bot, CircleAlert, Clock3, HardDrive, Play, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { Card, Meter, Pill, PageTitle } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { ScanModal } from '../components/ScanModal';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';
import { formatBytes, splitBytes } from '../utils/format';
import { timeSince } from '../utils/compareReports';
import type { Page } from '../config/navigation';

export function Overview({ setPage }: { setPage: (p: Page) => void }) {
  const [scanOpen, setScanOpen] = useState(false);
  const providers = useProviders();
  const device = useProviderData(() => providers.device.getActiveDevice());
  const health = useProviderData(() => providers.health.getHealthSnapshot('active'));
  const storage = useProviderData(() => providers.storage.getStorageSnapshot('active'));
  const performance = useProviderData(() => providers.performance.getPerformanceSnapshot('active'));
  const security = useProviderData(() => providers.security.getSecuritySnapshot('active'));
  const cleanup = useProviderData(() => providers.cleanup.getCleanupSnapshot('active'));
  const aiReport = useProviderData(() => providers.aiReport.getAIReport('active'));
  const history = useProviderData(() => providers.history.getHistory('active'));
  const comparison = useProviderData(async () => {
    const entries = history.data;
    if (!entries || entries.length < 2) return { status: 'empty' as const, data: null, source: 'local-scanner' as const };
    return providers.history.getComparison(entries[1].id, entries[0].id);
  }, [history.data]);

  const deviceName = device.data?.name ?? 'your device';

  return (
    <>
      <PageTitle
        title={`Good morning, Drave.`}
        copy={
          device.data?.lastInspectedAt
            ? `Your ${deviceName} was last inspected ${new Date(device.data.lastInspectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
            : `Run an inspection to see ${deviceName}'s health.`
        }
        action={
          <button className="button primary" onClick={() => setScanOpen(true)}>
            <Play size={15} /> Run inspection
          </button>
        }
      />
      {scanOpen && <ScanModal onClose={() => setScanOpen(false)} onComplete={() => window.location.reload()} />}

      <div className="metrics">
        <Card className="score" onClick={() => setPage('Health Score')} role="button" tabIndex={0}>
          <div className="metric-top">
            <span>Health score</span>
            <Activity size={18} />
          </div>
          <ProviderGate result={health}>
            {(data) => (
              <>
                <div className="score-value">
                  {data.overallScore}
                  <span>/100</span>
                </div>
                <p>
                  <span className="up">↑ {data.delta} points</span> {data.deltaWindow}
                </p>
                <div className="score-ring">
                  <div>
                    <b>{data.overallScore >= 90 ? 'Excellent' : data.overallScore >= 70 ? 'Good' : 'Needs attention'}</b>
                    <small>Device health</small>
                  </div>
                </div>
              </>
            )}
          </ProviderGate>
        </Card>

        <Card>
          <div className="metric-top">
            <span>Storage</span>
            <HardDrive size={18} />
          </div>
          <ProviderGate result={storage}>
            {(data) => {
              const [used, unit] = splitBytes(data.usedBytes);
              return (
                <>
                  <b className="big">
                    {used} <small>{unit} / {formatBytes(data.totalBytes)}</small>
                  </b>
                  <Meter value={data.capacityPercent} color="linear-gradient(90deg,#f3c467,#f47f66)" />
                  <p className="warning">
                    <CircleAlert size={14} /> {formatBytes(data.availableBytes)} available
                  </p>
                </>
              );
            }}
          </ProviderGate>
        </Card>

        <Card>
          <div className="metric-top">
            <span>Performance</span>
            <Zap size={18} />
          </div>
          <ProviderGate result={performance}>
            {(data) => (
              <>
                <b className="big">
                  {data.cpuPercent < 40 && data.memoryPercent < 80 ? 'Excellent' : 'Fair'}
                </b>
                <p>CPU {data.cpuPercent}% · Memory {data.memoryPercent}%</p>
                <div className="sparkline">{data.sparkline.map((v) => '▁▂▃▄▅▆▇█'[Math.min(v, 7)]).join('')}</div>
              </>
            )}
          </ProviderGate>
        </Card>

        <Card onClick={() => setPage('Security Analyzer')} role="button" tabIndex={0}>
          <div className="metric-top">
            <span>Security</span>
            <ShieldCheck size={18} />
          </div>
          <ProviderGate result={security}>
            {(data) => (
              <>
                <b className="big">
                  {data.itemsNeedingReview} <small>warnings</small>
                </b>
                {data.findings
                  .filter((f) => f.status === 'warning' || f.status === 'review')
                  .slice(0, 2)
                  .map((f) => (
                    <p key={f.id}>
                      <span className="warning-dot" /> {f.detail}
                    </p>
                  ))}
              </>
            )}
          </ProviderGate>
        </Card>
      </div>

      <div className="grid two">
        <Card>
          <div className="card-head">
            <div>
              <h2>Storage overview</h2>
              <p>Where your disk space is going</p>
            </div>
            <button onClick={() => setPage('Storage Analyzer')} className="ghost">
              View analyzer <ArrowUpRight size={15} />
            </button>
          </div>
          <ProviderGate result={storage}>
            {(data) => (
              <div className="storage">
                <div className="donut">
                  <b>
                    {splitBytes(data.usedBytes)[0]}
                    <small>{splitBytes(data.usedBytes)[1]} used</small>
                  </b>
                </div>
                <div className="legend">
                  {data.categories.map((c) => (
                    <p key={c.label}>
                      <i className={c.colorToken} />
                      {c.label} <b>{formatBytes(c.bytes)}</b>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </ProviderGate>
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <h2>Inspection activity</h2>
              <p>Latest events from this device</p>
            </div>
            <button onClick={() => setPage('History')} className="ghost">
              Full history <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="activity">
            <p>
              <span className="iconbox purple">
                <Bot size={16} />
              </span>
              <span>
                <b>AI report updated</b>
                <small>Health score improved by {health.data?.delta ?? '—'} points</small>
              </span>
              <time>4m</time>
            </p>
            <p>
              <span className="iconbox blue">
                <HardDrive size={16} />
              </span>
              <span>
                <b>Storage scan complete</b>
                <small>{storage.data ? formatBytes(storage.data.reclaimableBytes) : '—'} can be safely reclaimed</small>
              </span>
              <time>4m</time>
            </p>
            <p>
              <span className="iconbox orange">
                <ShieldCheck size={16} />
              </span>
              <span>
                <b>Security scan complete</b>
                <small>{security.data?.itemsNeedingReview ?? '—'} items need your attention</small>
              </span>
              <time>5m</time>
            </p>
          </div>
        </Card>
      </div>

      <div className="grid two lower">
        <Card>
          <div className="card-head">
            <div>
              <h2>Quick cleanup</h2>
              <p>Safe files ready to reclaim</p>
            </div>
            <ProviderGate result={cleanup}>
              {(data) => <Pill tone="green">{formatBytes(data.totalReclaimableBytes)} available</Pill>}
            </ProviderGate>
          </div>
          <ProviderGate result={cleanup}>
            {(data) => (
              <>
                {data.items.slice(0, 3).map((item) => (
                  <div className="row" key={item.id}>
                    <span className="file">
                      <Archive size={17} />
                      {item.label}
                    </span>
                    <Pill tone={item.risk === 'Safe' ? 'green' : 'orange'}>{item.risk}</Pill>
                    <b>{formatBytes(item.bytes)}</b>
                  </div>
                ))}
                <button onClick={() => setPage('Cleanup Recommendation')} className="full-button">
                  Review cleanup plan <ArrowUpRight size={15} />
                </button>
              </>
            )}
          </ProviderGate>
        </Card>

        <Card className="report-mini">
          <span className="eyebrow">
            <Sparkles size={14} /> AI INSIGHT
          </span>
          <ProviderGate result={aiReport}>
            {(data) => (
              <>
                <h2>{data.headline}</h2>
                <p>{data.summary}</p>
              </>
            )}
          </ProviderGate>
          <button onClick={() => setPage('AI Report')} className="button dark">
            Read full AI report <ArrowUpRight size={15} />
          </button>
          <div className="bot-orb">✦</div>
        </Card>
      </div>

      <div className="grid two lower">
        <Card className="changes-card">
          <div className="card-head">
            <div>
              <h2>Storage changes</h2>
              <p>What's different since your last scan</p>
            </div>
            <button onClick={() => setPage('History')} className="ghost">
              Scan history <ArrowUpRight size={15} />
            </button>
          </div>
          {!history.data || history.data.length < 2 ? (
            <p className="changes-empty">
              {history.data && history.data.length === 1
                ? 'This is your first scan. Run npm run scan again later to see what changed.'
                : 'No scans yet. Run npm run scan to get started.'}
            </p>
          ) : (
            <ProviderGate result={comparison} emptyLabel="Comparison unavailable for these scans.">
              {(data) => (
                <div className="changes-grid">
                  <div className="changes-stat">
                    <span>Biggest growth</span>
                    <b className={data.biggestGrowth ? 'growth' : ''}>
                      {data.biggestGrowth ? `${data.biggestGrowth.label} +${formatBytes(data.biggestGrowth.deltaBytes)}` : 'None'}
                    </b>
                  </div>
                  <div className="changes-stat">
                    <span>Biggest cleanup</span>
                    <b className={data.biggestCleanup ? 'recovered' : ''}>
                      {data.biggestCleanup ? `${data.biggestCleanup.label} -${formatBytes(Math.abs(data.biggestCleanup.deltaBytes))}` : 'None'}
                    </b>
                  </div>
                  <div className="changes-stat">
                    <span>Total difference</span>
                    <b className={data.totalDeltaBytes > 0 ? 'growth' : data.totalDeltaBytes < 0 ? 'recovered' : ''}>
                      {data.totalDeltaBytes === 0 ? '0 B' : `${data.totalDeltaBytes > 0 ? '+' : '-'}${formatBytes(Math.abs(data.totalDeltaBytes))}`}
                    </b>
                  </div>
                  <div className="changes-stat">
                    <span>Recovered space</span>
                    <b className="recovered">{formatBytes(data.recoveredBytes)}</b>
                  </div>
                  <div className="changes-stat">
                    <span>Last scan</span>
                    <b>{new Date(data.current.collectedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>
                  </div>
                  <div className="changes-stat">
                    <span>Time since last scan</span>
                    <b>{timeSince(data.current.collectedAt)}</b>
                  </div>
                </div>
              )}
            </ProviderGate>
          )}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <h2>Trend</h2>
              <p>At a glance</p>
            </div>
          </div>
          {comparison.data ? (
            <div className="trend-summary">
              {comparison.data.totalDeltaBytes >= 0 ? (
                <TrendingUp size={22} className="growth" />
              ) : (
                <TrendingDown size={22} className="recovered" />
              )}
              <p>
                Storage {comparison.data.totalDeltaBytes >= 0 ? 'grew' : 'shrank'} by{' '}
                <b>{formatBytes(Math.abs(comparison.data.totalDeltaBytes))}</b> since{' '}
                {timeSince(comparison.data.previous.collectedAt)}.
              </p>
            </div>
          ) : (
            <p className="changes-empty">
              <Clock3 size={16} /> Not enough scans yet to show a trend.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
