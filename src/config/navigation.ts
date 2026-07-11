import {
  Activity,
  Bot,
  Clock3,
  Code2,
  Gauge,
  HardDrive,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type Page =
  | 'Overview'
  | 'Storage Analyzer'
  | 'Security Analyzer'
  | 'Performance Analyzer'
  | 'Developer Environment'
  | 'Crypto Wallet Detector'
  | 'Cleanup Recommendation'
  | 'AI Report'
  | 'Health Score'
  | 'Settings'
  | 'History';

export const nav: { name: Page; icon: LucideIcon }[] = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Storage Analyzer', icon: HardDrive },
  { name: 'Security Analyzer', icon: ShieldCheck },
  { name: 'Performance Analyzer', icon: Gauge },
  { name: 'Developer Environment', icon: Code2 },
  { name: 'Crypto Wallet Detector', icon: Wallet },
  { name: 'Cleanup Recommendation', icon: Sparkles },
  { name: 'AI Report', icon: Bot },
  { name: 'Health Score', icon: Activity },
  { name: 'History', icon: Clock3 },
];
