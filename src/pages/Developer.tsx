import { Code2, Database, Sparkles, Terminal } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';
import { formatBytes } from '../utils/format';

export function Developer() {
  const providers = useProviders();
  const devEnv = useProviderData(() => providers.developerEnvironment.getDeveloperEnvironmentSnapshot('active'));

  return (
    <>
      <PageTitle
        title="Developer Environment"
        copy="Everything installed on this machine, understood in context."
        action={
          <button className="button">
            <Terminal size={15} /> Generate script
          </button>
        }
      />
      <ProviderGate result={devEnv}>
        {(data) => (
          <>
            <div className="dev-summary">
              <Card>
                <Code2 />
                <b>{data.toolCount} developer tools</b>
                <p>All environments detected</p>
              </Card>
              <Card>
                <Database />
                <b>{formatBytes(data.totalBytes)} in use</b>
                <p>Developer tooling & caches</p>
              </Card>
              <Card>
                <Sparkles />
                <b>AI understands context</b>
                <p>Nothing critical is removed</p>
              </Card>
            </div>
            <div className="tool-grid">
              {data.tools.map((tool, i) => (
                <Card key={tool.name} className="tool">
                  <span className={'tool-logo l' + i}>{tool.name[0]}</span>
                  <div>
                    <h3>{tool.name}</h3>
                    <p>{tool.detail}</p>
                  </div>
                  <Pill tone={tool.installed ? 'green' : 'neutral'}>{tool.installed ? 'Installed' : 'Not found'}</Pill>
                </Card>
              ))}
            </div>
          </>
        )}
      </ProviderGate>
    </>
  );
}
