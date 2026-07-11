import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface SizeLimits {
  /** Stop recursing past this depth (0 = only the folder itself). */
  maxDepth: number;
  /** Stop after visiting this many entries total, to bound scan time on huge trees. */
  maxEntries: number;
}

const DEFAULT_LIMITS: SizeLimits = { maxDepth: 6, maxEntries: 50_000 };

/**
 * Sums file sizes under `path`, never reading file contents — only
 * `stat()` metadata. Skips anything it can't access instead of failing the
 * whole scan (permission errors, broken symlinks, races with files being
 * deleted mid-scan are all expected on a live filesystem).
 */
export async function directorySize(path: string, limits: SizeLimits = DEFAULT_LIMITS): Promise<number> {
  let total = 0;
  let visited = 0;

  async function walk(current: string, depth: number): Promise<void> {
    if (visited >= limits.maxEntries) return;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return; // permission denied, not found, etc. — skip, don't fail the scan
    }

    for (const entry of entries) {
      if (visited >= limits.maxEntries) return;
      visited++;
      const entryPath = join(current, entry.name);

      if (entry.isSymbolicLink()) continue; // never follow symlinks — avoids cycles and escaping the intended tree

      if (entry.isDirectory()) {
        if (depth < limits.maxDepth) await walk(entryPath, depth + 1);
        continue;
      }

      try {
        const info = await stat(entryPath);
        total += info.size;
      } catch {
        // file vanished or unreadable mid-scan — skip it
      }
    }
  }

  try {
    const rootInfo = await stat(path);
    if (!rootInfo.isDirectory()) return rootInfo.size;
  } catch {
    return 0; // path doesn't exist on this machine — not an error, just absent
  }

  await walk(path, 0);
  return total;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
