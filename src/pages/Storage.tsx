import { useState } from 'react';
import { ChevronDown, Command, FolderOpen, Search } from 'lucide-react';
import { Card, Meter, PageTitle, Pill } from '../components/ui';
import { ProviderGate } from '../components/ProviderGate';
import { useProviders } from '../providers';
import { useProviderData } from '../hooks/useProviderData';
import { formatBytes, splitBytes } from '../utils/format';

export function StoragePage() {
  const providers = useProviders();
  const storage = useProviderData(() => providers.storage.getStorageSnapshot('active'));
  const [open, setOpen] = useState<string | ''>('');

  return (
    <>
      <PageTitle
        title="Storage Analyzer"
        copy="A complete map of your disk usage, organized for action."
        action={
          <button className="button">
            <Command size={15} /> Export report
          </button>
        }
      />
      <ProviderGate result={storage}>
        {(data) => (
          <>
            <div className="grid side">
              <Card className="storage-large">
                <div className="capacity">
                  <div className="disk">
                    <b>
                      {splitBytes(data.usedBytes)[0]}
                      <small>{splitBytes(data.usedBytes)[1]} used</small>
                    </b>
                  </div>
                  <div>
                    <Pill tone={data.capacityPercent >= 90 ? 'orange' : 'green'}>{data.capacityPercent}% capacity</Pill>
                    <h2>
                      {formatBytes(data.availableBytes)} <small>available</small>
                    </h2>
                    <p>
                      Your disk is {data.capacityPercent >= 90 ? 'nearing capacity' : 'in good shape'}. We found{' '}
                      {formatBytes(data.reclaimableBytes)} that can be reclaimed safely.
                    </p>
                    <button className="ghost">See cleanup recommendation</button>
                  </div>
                </div>
              </Card>
              <Card>
                <h3>Space by category</h3>
                <div className="category">
                  {data.categories.map((c) => (
                    <div key={c.label}>
                      <p>
                        {c.label} <b>{formatBytes(c.bytes)}</b>
                      </p>
                      <Meter value={c.percent} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="folder-card">
              <div className="card-head">
                <div>
                  <h2>Largest folders</h2>
                  <p>Click a folder to explore its contents</p>
                </div>
                <Search size={19} />
              </div>
              {data.largestFolders.map((folder) => (
                <div
                  className={'folder-row ' + (open === folder.path ? 'selected' : '')}
                  key={folder.path}
                  onClick={() => setOpen(open === folder.path ? '' : folder.path)}
                >
                  <FolderOpen size={18} />
                  <b>{folder.label}</b>
                  <span className="bar">
                    <i style={{ width: folder.percent + '%' }} />
                  </span>
                  <strong>{formatBytes(folder.bytes)}</strong>
                  <ChevronDown size={17} />
                  {open === folder.path && (
                    <div className="tree">
                      <span>› Library</span>
                      <span>› Cache</span>
                      <span>› Data</span>
                      <small>{folder.note ?? `${folder.label} contains files that are safe to review before removal.`}</small>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </>
        )}
      </ProviderGate>
    </>
  );
}
