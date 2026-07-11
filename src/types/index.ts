/**
 * Shared domain types for AI Check.
 *
 * These types define the JSON contract between the dashboard, the API,
 * the (future) scanner, and the (future) AI engine. Nothing in this file
 * should import from React or any UI library — it must stay portable
 * across the CLI scanner, the Worker API, and any future service.
 */

export type Platform = 'macos' | 'windows' | 'linux';

export type Severity = 'info' | 'good' | 'review' | 'warning' | 'critical';

export interface DeviceInfo {
  id: string;
  name: string;
  platform: Platform;
  osVersion: string;
  lastInspectedAt: string | null;
  /** e.g. "Mac15,6" — omitted where unavailable (mock data, other platforms). */
  model?: string;
}

/** Every provider result carries this envelope so the UI can render
 * loading / empty / error states uniformly instead of special-casing data. */
export interface ProviderResult<T> {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  data: T | null;
  error?: string;
  generatedAt?: string;
  source: 'mock' | 'local-scanner' | 'cloud-api';
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthBreakdownItem {
  label: string;
  score: number;
  status: Severity;
}

export interface HealthSnapshot {
  overallScore: number;
  delta: number;
  deltaWindow: string;
  breakdown: HealthBreakdownItem[];
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface StorageCategory {
  label: string;
  bytes: number;
  percent: number;
  colorToken: string;
}

export interface StorageFolder {
  path: string;
  label: string;
  bytes: number;
  percent: number;
  children?: string[];
  note?: string;
}

export interface StorageToolMeasurement {
  id: string;
  label: string;
  path: string;
  bytes: number;
}

export interface StorageSnapshot {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  capacityPercent: number;
  reclaimableBytes: number;
  categories: StorageCategory[];
  largestFolders: StorageFolder[];
  /** Every known tool/cache signature that was found, regardless of size —
   * kept alongside largestFolders (which is top-N only) so history
   * comparisons can track e.g. "Docker" even when it isn't currently one
   * of the largest folders on disk. Omitted by providers that don't
   * measure this (mock data). */
  tools?: StorageToolMeasurement[];
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

export interface SecurityFinding {
  id: string;
  label: string;
  detail: string;
  status: Severity;
}

export interface SecuritySnapshot {
  malwareIndicatorsFound: boolean;
  itemsNeedingReview: number;
  findings: SecurityFinding[];
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export interface PerformanceMetric {
  label: string;
  value: string;
  status: Severity;
}

export interface PerformanceSnapshot {
  cpuPercent: number;
  memoryPercent: number;
  sparkline: number[];
  metrics: PerformanceMetric[];
}

// ---------------------------------------------------------------------------
// Developer environment
// ---------------------------------------------------------------------------

export interface DeveloperTool {
  name: string;
  detail: string;
  installed: boolean;
}

export interface DeveloperEnvironmentSnapshot {
  toolCount: number;
  totalBytes: number;
  tools: DeveloperTool[];
}

// ---------------------------------------------------------------------------
// Crypto wallet detection
// ---------------------------------------------------------------------------

export interface WalletFinding {
  name: string;
  detected: boolean;
  status: Severity;
  detail?: string;
}

export interface CryptoSnapshot {
  walletsDetected: number;
  wallets: WalletFinding[];
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export interface CleanupItem {
  id: string;
  label: string;
  bytes: number;
  risk: 'Safe' | 'Review';
  path?: string;
  /** Shown to the user for manual review — AI Check never executes this. */
  command?: string;
}

export interface CleanupSnapshot {
  totalReclaimableBytes: number;
  items: CleanupItem[];
}

// ---------------------------------------------------------------------------
// AI report
// ---------------------------------------------------------------------------

export interface AIInsight {
  id: string;
  icon: 'opportunity' | 'positive' | 'security' | 'info';
  title: string;
  detail: string;
  actionLabel?: string;
  actionPage?: string;
}

export interface AIReportSnapshot {
  headline: string;
  summary: string;
  healthScore: number;
  reclaimableBytes: number;
  warningCount: number;
  insights: AIInsight[];
  model?: string;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  id: string;
  deviceName: string;
  inspectedAt: string;
  healthScore: number;
  // Additive fields for Storage History & Comparison — optional so older
  // history entries (or providers that don't track them) remain valid.
  usedBytes?: number;
  totalBytes?: number;
  reclaimableBytes?: number;
  largestFolderLabel?: string;
  largestFolderBytes?: number;
  /** Signed delta in `usedBytes` vs. the scan immediately before this one.
   * Positive = grew, negative = shrank, undefined = no previous scan to
   * compare against (e.g. the very first scan). */
  changeBytes?: number;
}

// ---------------------------------------------------------------------------
// Comparison (derived from two InspectionReports — not itself part of the
// InspectionReport contract, so it is exempt from SCHEMA.md's versioning
// rules for that type. See docs/HISTORY_FORMAT.md.)
// ---------------------------------------------------------------------------

export interface FolderDelta {
  label: string;
  path: string;
  previousBytes: number;
  currentBytes: number;
  deltaBytes: number;
}

export interface ComparisonInsight {
  id: string;
  message: string;
  tone: 'growth' | 'recovered' | 'neutral';
}

export interface ComparisonResult {
  previous: { id: string; collectedAt: string };
  current: { id: string; collectedAt: string };
  newFolders: StorageFolder[];
  removedFolders: StorageFolder[];
  grown: FolderDelta[];
  shrunk: FolderDelta[];
  unchanged: FolderDelta[];
  biggestGrowth: FolderDelta | null;
  biggestCleanup: FolderDelta | null;
  /** current.storage.usedBytes - previous.storage.usedBytes (signed). */
  totalDeltaBytes: number;
  /** Sum of all shrinkage — always >= 0. */
  recoveredBytes: number;
  insights: ComparisonInsight[];
}

// ---------------------------------------------------------------------------
// Inspection report (the JSON contract the scanner submits to the API)
// ---------------------------------------------------------------------------

export interface InspectionReport {
  schemaVersion: '1.0';
  device: DeviceInfo;
  storage: StorageSnapshot;
  security: SecuritySnapshot;
  performance: PerformanceSnapshot;
  developerEnvironment: DeveloperEnvironmentSnapshot;
  crypto: CryptoSnapshot;
  cleanup: CleanupSnapshot;
  collectedAt: string;
  scannerVersion: string;
}
