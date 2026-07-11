import { ShieldCheck, Wallet } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';

export function Crypto() {
  const providers = useProviders();
  const crypto = useProviderData(() => providers.crypto.getCryptoSnapshot('active'));

  return (
    <>
      <PageTitle
        title="Crypto Wallet Detector"
        copy="Detect wallet software and files without ever accessing private keys."
      />
      <ProviderGate result={crypto}>
        {(data) => {
          const detected = data.wallets.find((w) => w.detected);
          return (
            <>
              <Card className="crypto-hero">
                <Wallet size={28} />
                <div>
                  <Pill tone={data.walletsDetected ? 'orange' : 'green'}>
                    {data.walletsDetected} wallet{data.walletsDetected === 1 ? '' : 's'} detected
                  </Pill>
                  <h2>{detected ? detected.name : 'No wallet software detected'}</h2>
                  <p>{detected?.detail ?? 'No wallet data or private keys were accessed during this scan.'}</p>
                </div>
                {detected && <button className="button">Review finding</button>}
              </Card>
              <h2 className="section-title">Wallet checks</h2>
              <div className="wallet-grid">
                {data.wallets.map((wallet) => (
                  <Card key={wallet.name} className="wallet">
                    <span className="wallet-logo">{wallet.name[0]}</span>
                    <h3>{wallet.name}</h3>
                    <Pill tone={wallet.detected ? 'orange' : 'neutral'}>{wallet.detected ? 'Detected' : 'Not found'}</Pill>
                  </Card>
                ))}
              </div>
              <p className="privacy-note">
                <ShieldCheck size={16} /> AI Check only checks for application signatures and known file locations.
                Private keys are never read, transmitted, or stored.
              </p>
            </>
          );
        }}
      </ProviderGate>
    </>
  );
}
