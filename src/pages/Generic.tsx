import { Check, ChevronRight } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';
import { formatBytes } from '../utils/format';
import type { Page } from '../config/navigation';
import type { Severity } from '../types';

function toPillTone(status: Severity): string {
  return status === 'warning' || status === 'review' ? 'orange' : 'green';
}

function CleanupList() {
  const providers = useProviders();
  const cleanup = useProviderData(() => providers.cleanup.getCleanupSnapshot('active'));
  return (
    <ProviderGate result={cleanup}>
      {(data) => (
        <>
          {data.items.map((item) => (
            <div className="row" key={item.id}>
              <span className="file">
                <span className="row-icon">
                  <Check size={15} />
                </span>
                {item.label}
              </span>
              <span className="row-sub">{formatBytes(item.bytes)}</span>
              <Pill tone={item.risk === 'Safe' ? 'green' : 'orange'}>{item.risk}</Pill>
              <button className="icon-button">
                <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </>
      )}
    </ProviderGate>
  );
}

function PerformanceList() {
  const providers = useProviders();
  const performance = useProviderData(() => providers.performance.getPerformanceSnapshot('active'));
  return (
    <ProviderGate result={performance}>
      {(data) => (
        <>
          {data.metrics.map((metric) => (
            <div className="row" key={metric.label}>
              <span className="file">
                <span className="row-icon">
                  <Check size={15} />
                </span>
                {metric.label}
              </span>
              <span className="row-sub">{metric.value}</span>
              <Pill tone={toPillTone(metric.status)}>{metric.status === 'review' ? 'Review' : 'Normal'}</Pill>
              <button className="icon-button">
                <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </>
      )}
    </ProviderGate>
  );
}

function HealthBreakdownList() {
  const providers = useProviders();
  const health = useProviderData(() => providers.health.getHealthSnapshot('active'));
  return (
    <ProviderGate result={health}>
      {(data) => (
        <>
          {data.breakdown.map((item) => (
            <div className="row" key={item.label}>
              <span className="file">
                <span className="row-icon">
                  <Check size={15} />
                </span>
                {item.label}
              </span>
              <span className="row-sub">{item.score}/100</span>
              <Pill tone={toPillTone(item.status)}>{item.score >= 90 ? 'Excellent' : item.score >= 70 ? 'Good' : 'Review'}</Pill>
              <button className="icon-button">
                <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </>
      )}
    </ProviderGate>
  );
}

const PAGE_COPY: Partial<Record<Page, string>> = {
  'Cleanup Recommendation': 'Clear space with a safe, AI-reviewed cleanup plan.',
};

const PAGE_HEADING: Partial<Record<Page, string>> = {
  'Cleanup Recommendation': 'Recommended actions',
};

/** Generic list-detail layout shared by Cleanup, Performance, and Health
 * Score — each sources its rows from a different provider. History
 * (src/pages/History.tsx) and Settings (src/pages/Settings.tsx) have
 * their own dedicated pages since they need more than a list. */
export function Generic({ page }: { page: Page }) {
  const list =
    page === 'Cleanup Recommendation' ? (
      <CleanupList />
    ) : page === 'Performance Analyzer' ? (
      <PerformanceList />
    ) : (
      <HealthBreakdownList />
    );

  return (
    <>
      <PageTitle title={page} copy={PAGE_COPY[page] ?? 'A focused view of your device health.'} />
      <Card>
        <div className="card-head">
          <div>
            <h2>{PAGE_HEADING[page] ?? 'Health breakdown'}</h2>
            <p>Last inspection completed 4 minutes ago</p>
          </div>
          <Pill tone="green">Up to date</Pill>
        </div>
        {list}
      </Card>
    </>
  );
}
