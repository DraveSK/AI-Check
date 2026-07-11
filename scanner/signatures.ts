/**
 * Known storage consumers, recognized by a fixed path relative to $HOME.
 *
 * This is deliberately a plain array, not a database or a plugin registry
 * (see docs/SCANNER_DESIGN.md). Adding a tool is a one-entry edit here.
 */

export type SignatureRisk = 'Safe' | 'Review' | 'Protected';

export interface ToolSignature {
  id: string;
  label: string;
  /** Path relative to $HOME. */
  relativePath: string;
  category: 'developer' | 'cache' | 'application';
  riskLevel: SignatureRisk;
  /** Only surfaced as a recommendation once measured size exceeds this. */
  largeThresholdBytes: number;
  /** Shown to the user, never executed by AI Check. */
  cleanupCommand?: string;
}

const GB = 1024 ** 3;

export const KNOWN_TOOLS: ToolSignature[] = [
  { id: 'docker', label: 'Docker', relativePath: 'Library/Containers/com.docker.docker/Data/vms', category: 'developer', riskLevel: 'Safe', largeThresholdBytes: 10 * GB, cleanupCommand: 'docker system prune -a' },
  { id: 'homebrew-cache', label: 'Homebrew cache', relativePath: 'Library/Caches/Homebrew', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 2 * GB, cleanupCommand: 'brew cleanup' },
  { id: 'flutter-pub-cache', label: 'Flutter / pub-cache', relativePath: '.pub-cache', category: 'developer', riskLevel: 'Safe', largeThresholdBytes: 3 * GB, cleanupCommand: 'flutter clean' },
  { id: 'android-studio', label: 'Android Studio', relativePath: 'Library/Application Support/Google/AndroidStudio*', category: 'developer', riskLevel: 'Review', largeThresholdBytes: 5 * GB },
  { id: 'xcode-derived-data', label: 'Xcode DerivedData', relativePath: 'Library/Developer/Xcode/DerivedData', category: 'developer', riskLevel: 'Safe', largeThresholdBytes: 5 * GB, cleanupCommand: 'rm -rf ~/Library/Developer/Xcode/DerivedData/*' },
  { id: 'xcode-device-support', label: 'Xcode iOS DeviceSupport', relativePath: 'Library/Developer/Xcode/iOS DeviceSupport', category: 'developer', riskLevel: 'Review', largeThresholdBytes: 5 * GB },
  { id: 'npm-cache', label: 'npm cache', relativePath: '.npm', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB, cleanupCommand: 'npm cache clean --force' },
  { id: 'yarn-cache', label: 'Yarn cache', relativePath: 'Library/Caches/Yarn', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB, cleanupCommand: 'yarn cache clean' },
  { id: 'pnpm-store', label: 'pnpm store', relativePath: 'Library/pnpm', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB, cleanupCommand: 'pnpm store prune' },
  { id: 'bun-cache', label: 'bun cache', relativePath: '.bun/install/cache', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB, cleanupCommand: 'bun pm cache rm' },
  { id: 'pip-cache', label: 'pip cache', relativePath: 'Library/Caches/pip', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB, cleanupCommand: 'pip cache purge' },
  { id: 'cargo', label: 'Rust / Cargo', relativePath: '.cargo/registry', category: 'developer', riskLevel: 'Safe', largeThresholdBytes: 2 * GB, cleanupCommand: 'cargo cache -a' },
  { id: 'go-pkg', label: 'Go module cache', relativePath: 'go/pkg/mod', category: 'developer', riskLevel: 'Safe', largeThresholdBytes: 2 * GB, cleanupCommand: 'go clean -modcache' },
  { id: 'gradle-caches', label: 'Gradle / Java', relativePath: '.gradle/caches', category: 'developer', riskLevel: 'Safe', largeThresholdBytes: 2 * GB, cleanupCommand: 'gradle cleanBuildCache' },
  { id: 'vscode-extensions', label: 'VS Code extensions', relativePath: '.vscode/extensions', category: 'developer', riskLevel: 'Review', largeThresholdBytes: 2 * GB },
  { id: 'chrome-cache', label: 'Chrome cache', relativePath: 'Library/Caches/Google/Chrome', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 2 * GB },
  { id: 'safari-cache', label: 'Safari cache', relativePath: 'Library/Caches/com.apple.Safari', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB },
  { id: 'firefox-cache', label: 'Firefox cache', relativePath: 'Library/Caches/Firefox', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB },
  { id: 'zoom', label: 'Zoom', relativePath: 'Library/Application Support/zoom.us', category: 'application', riskLevel: 'Review', largeThresholdBytes: 2 * GB },
  { id: 'slack-cache', label: 'Slack cache', relativePath: 'Library/Application Support/Slack/Cache', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB },
  { id: 'discord-cache', label: 'Discord cache', relativePath: 'Library/Application Support/discord/Cache', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 1 * GB },
  { id: 'spotify-cache', label: 'Spotify cache', relativePath: 'Library/Caches/com.spotify.client', category: 'cache', riskLevel: 'Safe', largeThresholdBytes: 2 * GB },
  { id: 'dropbox', label: 'Dropbox', relativePath: 'Library/CloudStorage/Dropbox', category: 'application', riskLevel: 'Review', largeThresholdBytes: 10 * GB },
  { id: 'google-drive', label: 'Google Drive', relativePath: 'Library/CloudStorage/GoogleDrive', category: 'application', riskLevel: 'Review', largeThresholdBytes: 10 * GB },
  { id: 'onedrive', label: 'OneDrive', relativePath: 'Library/CloudStorage/OneDrive', category: 'application', riskLevel: 'Review', largeThresholdBytes: 10 * GB },
  { id: 'icloud-drive', label: 'iCloud Drive', relativePath: 'Library/Mobile Documents/com~apple~CloudDocs', category: 'application', riskLevel: 'Review', largeThresholdBytes: 10 * GB },
];
