/**
 * Static fixture data used exclusively by the mock providers.
 *
 * This is the only file in the codebase allowed to contain hand-authored
 * numbers standing in for a real device. Everything else consumes it
 * through a provider interface. When a real provider (local-scanner or
 * cloud-api) is implemented, this file can be deleted without touching
 * any screen.
 */
import type {
  AIReportSnapshot,
  CleanupSnapshot,
  ComparisonResult,
  CryptoSnapshot,
  DeveloperEnvironmentSnapshot,
  DeviceInfo,
  HealthSnapshot,
  HistoryEntry,
  PerformanceSnapshot,
  SecuritySnapshot,
  StorageSnapshot,
} from '../../types';

const GB = 1024 * 1024 * 1024;

export const mockDevice: DeviceInfo = {
  id: 'demo-macbook-pro',
  name: 'MacBook Pro',
  platform: 'macos',
  osVersion: 'macOS Sequoia 15.2',
  lastInspectedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
};

export const mockHealth: HealthSnapshot = {
  overallScore: 92,
  delta: 4,
  deltaWindow: 'since last week',
  breakdown: [
    { label: 'Storage health', score: 88, status: 'good' },
    { label: 'Security posture', score: 94, status: 'good' },
    { label: 'Performance', score: 96, status: 'good' },
    { label: 'Developer environment', score: 91, status: 'good' },
  ],
};

export const mockStorage: StorageSnapshot = {
  totalBytes: 512 * GB,
  usedBytes: 472 * GB,
  availableBytes: 40 * GB,
  capacityPercent: 92,
  reclaimableBytes: 104 * GB,
  categories: [
    { label: 'Developer tools', bytes: 149 * GB, percent: 31, colorToken: 'c2' },
    { label: 'Applications', bytes: 102 * GB, percent: 22, colorToken: 'c1' },
    { label: 'System & other', bytes: 165 * GB, percent: 35, colorToken: 'c4' },
  ],
  largestFolders: [
    { path: '/Applications', label: 'Applications', bytes: 102 * GB, percent: 20 },
    { path: '~/Docker', label: 'Docker', bytes: 84 * GB, percent: 16, note: 'Docker contains files that are safe to review before removal.' },
    { path: '~/Flutter', label: 'Flutter', bytes: 38 * GB, percent: 7 },
    { path: '~/Node', label: 'Node', bytes: 27 * GB, percent: 5 },
    { path: '~/Downloads', label: 'Downloads', bytes: 23 * GB, percent: 4 },
    { path: '~/Desktop', label: 'Desktop', bytes: 18 * GB, percent: 3 },
    { path: '~/Documents', label: 'Documents', bytes: 15 * GB, percent: 3 },
    { path: '~/Library/Caches', label: 'Caches', bytes: 59 * GB, percent: 12 },
  ],
};

export const mockSecurity: SecuritySnapshot = {
  malwareIndicatorsFound: false,
  itemsNeedingReview: 2,
  findings: [
    { id: 'ssh-keys', label: 'SSH Keys', detail: '12 keys found', status: 'review' },
    { id: 'api-keys', label: 'API Keys', detail: '4 files found · 1 exposed', status: 'warning' },
    { id: 'dotenv', label: '.env files', detail: '8 files found · no issues', status: 'good' },
    { id: 'private-keys', label: 'Private Keys', detail: '2 certificates found', status: 'good' },
    { id: 'wallet-files', label: 'Wallet Files', detail: '1 wallet detected', status: 'warning' },
    { id: 'browser-passwords', label: 'Browser Passwords', detail: 'Safari keychain', status: 'good' },
    { id: 'git-credentials', label: 'Git Credentials', detail: '1 credential helper', status: 'good' },
    { id: 'certificates', label: 'Certificates', detail: '14 certificates', status: 'good' },
  ],
};

export const mockPerformance: PerformanceSnapshot = {
  cpuPercent: 12,
  memoryPercent: 61,
  sparkline: [1, 2, 1, 3, 2, 4, 2, 3, 1, 2, 2],
  metrics: [
    { label: 'CPU usage', value: '12%', status: 'good' },
    { label: 'Memory pressure', value: '61%', status: 'good' },
    { label: 'Battery health', value: '94%', status: 'good' },
    { label: 'Startup apps', value: '9 enabled', status: 'review' },
  ],
};

export const mockDeveloperEnvironment: DeveloperEnvironmentSnapshot = {
  toolCount: 11,
  totalBytes: 149 * GB,
  tools: [
    { name: 'Docker', detail: '4 containers, 38 GB images', installed: true },
    { name: 'Node.js', detail: 'v22.14 · 12 projects', installed: true },
    { name: 'Python', detail: '3.12 · 6 virtual envs', installed: true },
    { name: 'Java', detail: 'JDK 21', installed: true },
    { name: 'Go', detail: 'v1.23', installed: true },
    { name: 'Rust', detail: '1.83 stable', installed: true },
    { name: 'Flutter', detail: '3.27 · 38 GB', installed: true },
    { name: 'Android Studio', detail: '2024.2', installed: true },
    { name: 'Xcode', detail: '16.2 · 48 GB', installed: true },
    { name: 'VS Code', detail: '42 extensions', installed: true },
    { name: 'Homebrew', detail: '187 packages', installed: true },
  ],
};

export const mockCrypto: CryptoSnapshot = {
  walletsDetected: 1,
  wallets: [
    { name: 'Bitcoin Core', detected: false, status: 'info' },
    { name: 'MetaMask', detected: true, status: 'warning', detail: 'Detected in your Chrome profile. No wallet data or private keys were accessed.' },
    { name: 'Ledger Live', detected: false, status: 'info' },
    { name: 'Electrum', detected: false, status: 'info' },
    { name: 'Solana CLI', detected: false, status: 'info' },
    { name: 'Exodus', detected: false, status: 'info' },
    { name: 'Monero', detected: false, status: 'info' },
    { name: 'Trust Wallet', detected: false, status: 'info' },
  ],
};

export const mockCleanup: CleanupSnapshot = {
  totalReclaimableBytes: 104 * GB,
  items: [
    { id: 'node-cache', label: 'Node Cache', bytes: 18 * GB, risk: 'Safe' },
    { id: 'docker-cache', label: 'Docker build cache', bytes: 32 * GB, risk: 'Safe' },
    { id: 'chrome-cache', label: 'Chrome Cache', bytes: 6 * GB, risk: 'Safe' },
    { id: 'xcode-derived-data', label: 'Xcode derived data', bytes: 48 * GB, risk: 'Review' },
  ],
};

export const mockAIReport: AIReportSnapshot = {
  headline: 'Your Mac is healthy.',
  summary: 'You can safely free 104 GB without affecting any applications.',
  healthScore: 92,
  reclaimableBytes: 104 * GB,
  warningCount: 2,
  model: 'mock',
  insights: [
    {
      id: 'largest-opportunity',
      icon: 'opportunity',
      title: 'Largest opportunity',
      detail: 'Docker images are taking 38 GB. Remove unused images to reclaim space quickly.',
      actionLabel: 'Open Docker cleanup',
      actionPage: 'Cleanup Recommendation',
    },
    {
      id: 'dev-ready',
      icon: 'positive',
      title: 'Development-ready',
      detail: 'Flutter SDK is installed and your development environment is healthy.',
      actionLabel: 'View developer tools',
      actionPage: 'Developer Environment',
    },
    {
      id: 'security-status',
      icon: 'security',
      title: 'Security status',
      detail: 'No malware indicators found. One crypto wallet is present on this device.',
      actionLabel: 'Review security',
      actionPage: 'Security Analyzer',
    },
  ],
};

export const mockHistory: HistoryEntry[] = [
  { id: 'h1', deviceName: 'MacBook Pro', inspectedAt: 'Today, 09:41', healthScore: 92, usedBytes: 472 * GB, totalBytes: 512 * GB, reclaimableBytes: 104 * GB, largestFolderLabel: 'Applications', largestFolderBytes: 102 * GB, changeBytes: 6 * GB },
  { id: 'h2', deviceName: 'MacBook Pro', inspectedAt: 'Yesterday, 18:23', healthScore: 88, usedBytes: 466 * GB, totalBytes: 512 * GB, reclaimableBytes: 98 * GB, largestFolderLabel: 'Applications', largestFolderBytes: 101 * GB, changeBytes: -3 * GB },
  { id: 'h3', deviceName: 'MacBook Pro', inspectedAt: 'Jul 8, 11:17', healthScore: 89, usedBytes: 469 * GB, totalBytes: 512 * GB, reclaimableBytes: 96 * GB, largestFolderLabel: 'Applications', largestFolderBytes: 100 * GB },
];

export const mockComparison: ComparisonResult = {
  previous: { id: 'h2', collectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  current: { id: 'h1', collectedAt: new Date().toISOString() },
  newFolders: [],
  removedFolders: [],
  grown: [
    { label: 'Docker', path: '~/Library/Containers/com.docker.docker', previousBytes: 72 * GB, currentBytes: 84 * GB, deltaBytes: 12 * GB },
  ],
  shrunk: [
    { label: 'Downloads', path: '~/Downloads', previousBytes: 41 * GB, currentBytes: 23 * GB, deltaBytes: -18 * GB },
  ],
  unchanged: [],
  biggestGrowth: { label: 'Docker', path: '~/Library/Containers/com.docker.docker', previousBytes: 72 * GB, currentBytes: 84 * GB, deltaBytes: 12 * GB },
  biggestCleanup: { label: 'Downloads', path: '~/Downloads', previousBytes: 41 * GB, currentBytes: 23 * GB, deltaBytes: -18 * GB },
  totalDeltaBytes: 6 * GB,
  recoveredBytes: 18 * GB,
  insights: [
    { id: 'docker-growth', message: 'Docker grew by 12 GB. Review unused images.', tone: 'growth' },
    { id: 'downloads-cleanup', message: 'Downloads shrank by 18 GB since the last scan.', tone: 'recovered' },
  ],
};
