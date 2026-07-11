import { Activity, Archive, ArrowUpRight, Bot, CircleAlert, HardDrive, Play, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Card, Meter, Pill, PageTitle } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';
import { formatBytes, splitBytes } from '../utils/format';
import type { Page } from '../config/navigation';

export function Overview({ setPage }: { setPage: (p: Page) => void }) {
  const providers = useProviders();
  const device = useProviderData(() => providers.device.getActiveDevice());
  const health = useProviderData(() => providers.health.getHealthSnapshot('active'));
  const storage = useProviderData(() => providers.storage.getStorageSnapshot('active'));
  const performance = useProviderData(() => providers.performance.getPerformanceSnapshot('active'));
  const security = useProviderData(() => providers.security.getSecuritySnapshot('active'));
  const cleanup = useProviderData(() => providers.cleanup.getCleanupSnapshot('active'));
  const aiReport = useProviderData(() => providers.aiReport.getAIReport('active'));

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
          <button className="button primary">
            <Play size={15} /> Run inspection
          </button>
        }
      />

      <div className="metrics">
        <Card className="score">
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

        <Card>
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
    </>
  );
}
