import { Check, ChevronRight, KeyRound, ShieldCheck } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';

export function SecurityPage() {
  const providers = useProviders();
  const security = useProviderData(() => providers.security.getSecuritySnapshot('active'));

  return (
    <>
      <PageTitle
        title="Security Analyzer"
        copy="Sensitive files are identified locally. AI Check never reads secret values."
        action={
          <Pill tone="green">
            <Check size={13} /> Scan complete
          </Pill>
        }
      />
      <ProviderGate result={security}>
        {(data) => (
          <>
            <Card className="security-hero">
              <div>
                <span className="eyebrow">
                  <ShieldCheck size={14} /> PRIVACY-FIRST INSPECTION
                </span>
                <h2>{data.malwareIndicatorsFound ? 'Indicators found — review recommended.' : 'No malware indicators found.'}</h2>
                <p>
                  {data.itemsNeedingReview} item{data.itemsNeedingReview === 1 ? '' : 's'} deserve a quick review. Your
                  sensitive content remains on your device at all times.
                </p>
              </div>
              <div className="shield">
                ✓<small>Protected</small>
              </div>
            </Card>
            <div className="security-list">
              {data.findings.map((finding, i) => (
                <Card key={finding.id} className="security-item">
                  <span className={'security-icon i' + i}>
                    <KeyRound size={18} />
                  </span>
                  <div>
                    <h3>{finding.label}</h3>
                    <p>{finding.detail}</p>
                  </div>
                  <Pill tone={finding.status === 'warning' || finding.status === 'review' ? 'orange' : 'green'}>
                    {finding.status === 'warning' ? 'Warning' : finding.status === 'review' ? 'Review access' : 'Protected'}
                  </Pill>
                  <button className="icon-button">
                    <ChevronRight size={16} />
                  </button>
                </Card>
              ))}
            </div>
          </>
        )}
      </ProviderGate>
    </>
  );
}
