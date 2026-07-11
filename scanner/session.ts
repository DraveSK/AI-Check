import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SESSION_DIR = join(homedir(), '.ai-check');
const SESSION_PATH = join(SESSION_DIR, 'session.json');

export interface StoredSession {
  apiUrl: string;
  sessionToken: string;
  email: string;
  expiresAt: string;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true });
  await writeFile(SESSION_PATH, JSON.stringify(session, null, 2), { mode: 0o600 });
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await readFile(SESSION_PATH, 'utf-8');
    const session = JSON.parse(raw) as StoredSession;
    if (new Date(session.expiresAt) < new Date()) return null;
    return session;
  } catch {
    return null;
  }
}
