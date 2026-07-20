import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Laptop, Moon, Search, Settings, Sun } from 'lucide-react';
import { ProviderRoot, useProviders } from './providers';
import { useProviderData } from './hooks/useProviderData';
import { navForPermissions, PAGE_PERMISSION, type Page } from './config/navigation';
import { Overview } from './pages/Overview';
import { StoragePage } from './pages/Storage';
import { SecurityPage } from './pages/Security';
import { Developer } from './pages/Developer';
import { Crypto } from './pages/Crypto';
import { Report } from './pages/Report';
import { HistoryPage } from './pages/History';
import { Generic } from './pages/Generic';
import { SettingsPage } from './pages/Settings';
import { UsersPage } from './pages/Users';
import { AnalyticsPage } from './pages/Analytics';
import { AuditLogsPage } from './pages/AuditLogs';
import { PlatformPage } from './pages/Platform';
import { Forbidden } from './components/Forbidden';
import { PrivacyNotice } from './components/PrivacyNotice';
import { useCloudAuth, type CloudUser } from './hooks/useCloudAuth';

function Dashboard({ user }: { user: CloudUser | null }) {
  const [page, setPage] = useState<Page>('Overview');
  const [dark, setDark] = useState(true);
  const providers = useProviders();
  const device = useProviderData(() => providers.device.getActiveDevice());
  const security = useProviderData(() => providers.security.getSecuritySnapshot('active'));

  // null permissions (mock/local-report mode) = full access, same as
  // always; in cloud-api mode, a page listed in PAGE_PERMISSION is
  // gated — see docs/RBAC.md §Route guards. A 403 view, never a redirect.
  const requiredPermission = PAGE_PERMISSION[page];
  const forbidden = requiredPermission && user && !user.permissions.includes(requiredPermission);

  const content = forbidden ? (
    <Forbidden page={page} />
  ) : page === 'Overview' ? (
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
  ) : page === 'Users' ? (
    <UsersPage permissions={user?.permissions ?? []} />
  ) : page === 'Analytics' ? (
    <AnalyticsPage />
  ) : page === 'Audit Logs' ? (
    <AuditLogsPage />
  ) : page === 'Platform' ? (
    <PlatformPage />
  ) : (
    <Generic page={page} />
  );

  const nav = navForPermissions(user?.permissions ?? null);
  const workspaceName = user?.isGuest ? 'This device' : user?.display_name || user?.email || 'Drave Team';
  const initials = user?.isGuest ? 'DV' : (user?.email ?? 'DT').slice(0, 2).toUpperCase();

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside>
        <div className="brand">
          <img src="/ai-check-logo.png" alt="AI Check" />
          <span>AI Check</span>
        </div>
        <div className="workspace">
          <span className="avatar">{initials}</span>
          <div>
            <b>{workspaceName}</b>
            <small>{user?.isGuest ? 'Stored on this device' : user ? user.role.replace('_', ' ') : 'Personal workspace'}</small>
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
            <span className="avatar large">{initials}</span>
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

  if (!isCloudApi) return <Dashboard user={null} />;
  if (auth.status === 'checking') return null;
  // No sign-in gate: a fresh visitor gets a guest session automatically
  // (see useCloudAuth) so they land straight on the dashboard. If that
  // silently fails (e.g. DB unavailable), fall through to a read-only
  // dashboard rather than blocking on a login screen — see
  // docs/RBAC.md §Guest accounts for why there's no account requirement
  // by default.
  return (
    <>
      <Dashboard user={auth.user} />
      <PrivacyNotice />
    </>
  );
}

export default function App() {
  return (
    <ProviderRoot>
      <Gate />
    </ProviderRoot>
  );
}
