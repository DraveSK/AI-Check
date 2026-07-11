import { ArrowUpRight, FileCode2, Sparkles } from 'lucide-react';
import { Card, PageTitle } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';
import { formatBytes } from '../utils/format';
import type { Page } from '../config/navigation';

const ICONS: Record<string, { tone: string; glyph: string }> = {
  opportunity: { tone: 'yellow', glyph: '↗' },
  positive: { tone: 'purple', glyph: '✦' },
  security: { tone: 'green', glyph: '✓' },
  info: { tone: 'yellow', glyph: 'ℹ' },
};

export function Report({ setPage }: { setPage: (p: Page) => void }) {
  const providers = useProviders();
  const aiReport = useProviderData(() => providers.aiReport.getAIReport('active'));

  return (
    <>
      <PageTitle
        title="AI Report"
        copy="An intelligent summary of your device health and the actions worth taking."
        action={
          <button className="button primary">
            <FileCode2 size={15} /> Generate script
          </button>
        }
      />
      <ProviderGate result={aiReport}>
        {(data) => (
          <>
            <Card className="ai-report">
              <div className="report-glow" />
              <span className="eyebrow">
                <Sparkles size={14} /> {data.model && data.model !== 'mock' ? data.model.toUpperCase() : 'AI CHECK INTELLIGENCE'}
              </span>
              <h1>{data.headline}</h1>
              <p>{data.summary}</p>
              <div className="report-stats">
                <span>
                  <b>{data.healthScore}</b>Health score
                </span>
                <span>
                  <b>{formatBytes(data.reclaimableBytes)}</b>Safe to free
                </span>
                <span>
                  <b>{data.warningCount}</b>Warnings
                </span>
              </div>
            </Card>
            <div className="insights">
              {data.insights.map((insight) => (
                <Card key={insight.id}>
                  <span className={'insight-icon ' + (ICONS[insight.icon]?.tone ?? 'yellow')}>
                    {ICONS[insight.icon]?.glyph ?? '•'}
                  </span>
                  <h3>{insight.title}</h3>
                  <p>{insight.detail}</p>
                  {insight.actionLabel && insight.actionPage && (
                    <button className="ghost" onClick={() => setPage(insight.actionPage as Page)}>
                      {insight.actionLabel} <ArrowUpRight size={15} />
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </ProviderGate>
    </>
  );
}
