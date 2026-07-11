import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Laptop, Moon, Search, Settings, Sun } from 'lucide-react';
import { ProviderRoot, useProviders } from './providers';
import { useProviderData } from './hooks/useProviderData';
import { nav, type Page } from './config/navigation';
import { Overview } from './pages/Overview';
import { StoragePage } from './pages/Storage';
import { SecurityPage } from './pages/Security';
import { Developer } from './pages/Developer';
import { Crypto } from './pages/Crypto';
import { Report } from './pages/Report';
import { HistoryPage } from './pages/History';
import { Generic } from './pages/Generic';
import { SettingsPage } from './pages/Settings';
import { Login } from './pages/Login';
import { useCloudAuth } from './hooks/useCloudAuth';

function Dashboard() {
  const [page, setPage] = useState<Page>('Overview');
  const [dark, setDark] = useState(true);
  const providers = useProviders();
  const device = useProviderData(() => providers.device.getActiveDevice());
  const security = useProviderData(() => providers.security.getSecuritySnapshot('active'));

  const content =
    page === 'Overview' ? (
      <Overview setPage={setPage} />
    ) : page === 'Storage Analyzer' ? (
      <StoragePage />
    ) : page === 'Security Analyzer' ? (
      <SecurityPage />
    ) : page === 'Developer Environment' ? (
      <Developer />
    ) : page === 'Crypto Wallet Detector' ? (
      <Crypto />
    ) : page === 'AI Report' ? (
      <Report setPage={setPage} />
    ) : page === 'History' ? (
      <HistoryPage />
    ) : page === 'Settings' ? (
      <SettingsPage />
    ) : (
      <Generic page={page} />
    );

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside>
        <div className="brand">
          <img src="/ai-check-logo.png" alt="AI Check" />
          <span>AI Check</span>
        </div>
        <div className="workspace">
          <span className="avatar">DT</span>
          <div>
            <b>Drave Team</b>
            <small>Personal workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button key={name} onClick={() => setPage(name)} className={page === name ? 'active' : ''}>
              <Icon size={18} />
              {name}
              {name === 'Security Analyzer' && security.data && security.data.itemsNeedingReview > 0 && (
                <i>{security.data.itemsNeedingReview}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button onClick={() => setPage('Settings')} className={page === 'Settings' ? 'active' : ''}>
            <Settings size={18} />
            Settings
          </button>
          <button onClick={() => setDark(!dark)}>
            <span>{dark ? <Moon size={18} /> : <Sun size={18} />}</span>
            {dark ? 'Dark mode' : 'Light mode'}
            <span className="switch">
              <i />
            </span>
          </button>
          <div className="device">
            <Laptop size={17} />
            <span>
              <b>{device.data?.name ?? 'Device'}</b>
              <small>{device.data?.osVersion ?? '—'}</small>
            </span>
            <span className="online" />
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="crumb">
            <span>AI Check</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <button className="search">
              <Search size={17} /> Search <kbd>⌘ K</kbd>
            </button>
            <button className="bell">●</button>
            <span className="avatar large">DT</span>
          </div>
        </header>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18 }}
            className="content"
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Gate() {
  const isCloudApi = import.meta.env.VITE_PROVIDER_MODE === 'cloud-api';
  const auth = useCloudAuth();

  if (!isCloudApi) return <Dashboard />;
  if (auth.status === 'checking') return null;
  if (auth.status === 'signed-out') return <Login />;
  return <Dashboard />;
}

export default function App() {
  return (
    <ProviderRoot>
      <Gate />
    </ProviderRoot>
  );
}
