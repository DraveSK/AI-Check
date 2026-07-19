/**
 * Thin, typed wrappers over D1's own query builder — not an ORM. Each
 * function maps directly to one query in d1/migrations/0001_init.sql.
 * Adding a query means adding a function here, not learning a new
 * abstraction (see docs/SCANNER_DESIGN.md "prefer simple functions").
 */
import type { Platform } from '../../src/types';

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  role: string; // 'user' | 'admin' | 'super_admin' — see worker/lib/rbac.ts
  status: string; // 'active' | 'disabled'
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  platform: Platform;
  os_version: string | null;
  model: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  user_id: string;
  device_id: string;
  schema_version: string;
  scanner_version: string;
  r2_key: string;
  used_bytes: number;
  total_bytes: number;
  reclaimable_bytes: number;
  collected_at: string;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  provider: string;
  encrypted_key: string;
  iv: string;
  created_at: string;
}

export interface SettingsRow {
  user_id: string;
  preferred_ai_provider: string | null;
  preferred_ai_model: string | null;
  updated_at: string;
}

/** The very first account ever created becomes `super_admin` — someone
 * has to be able to promote everyone else, and for a solo founder
 * standing up their own instance, "whoever signs in first" is the
 * simplest possible bootstrap with no separate setup step. Every
 * subsequent signup is a plain `user`. See docs/RBAC.md §Bootstrapping. */
export async function findOrCreateUser(db: D1Database, email: string): Promise<UserRow> {
  const existing = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (existing) return existing;

  const { count } = (await db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>()) ?? { count: 0 };
  const role = count === 0 ? 'super_admin' : 'user';

  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO users (id, email, role) VALUES (?, ?, ?)').bind(id, email, role).run();
  const created = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (!created) throw new Error('Failed to create user.');
  return created;
}

export async function updateLastLogin(db: D1Database, userId: string): Promise<void> {
  await db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(userId).run();
}

export async function listUsers(db: D1Database, search?: string, limit = 100): Promise<UserRow[]> {
  const query = search
    ? db.prepare('SELECT * FROM users WHERE email LIKE ? OR display_name LIKE ? ORDER BY created_at DESC LIMIT ?').bind(`%${search}%`, `%${search}%`, limit)
    : db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?').bind(limit);
  const { results } = await query.all<UserRow>();
  return results;
}

export async function getUserById(db: D1Database, userId: string): Promise<UserRow | null> {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  return row ?? null;
}

export async function updateUserRole(db: D1Database, userId: string, role: string): Promise<void> {
  await db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").bind(role, userId).run();
}

export async function updateUserStatus(db: D1Database, userId: string, status: string): Promise<void> {
  await db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, userId).run();
}

export interface PlatformStats {
  totalUsers: number;
  activeUsersLast30Days: number;
  totalReports: number;
  reportsToday: number;
  totalStorageBytes: number;
  scannerVersions: { version: string; count: number }[];
}

export async function getPlatformStats(db: D1Database): Promise<PlatformStats> {
  const [users, activeUsers, reports, reportsToday, storage, versions] = await Promise.all([
    db.prepare('SELECT COUNT(*) as n FROM users').first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM users WHERE last_login > datetime('now', '-30 days')").first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) as n FROM reports').first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM reports WHERE created_at > datetime('now', '-1 day')").first<{ n: number }>(),
    db.prepare('SELECT COALESCE(SUM(used_bytes), 0) as n FROM reports').first<{ n: number }>(),
    db.prepare('SELECT scanner_version as version, COUNT(*) as count FROM reports GROUP BY scanner_version ORDER BY count DESC').all<{ version: string; count: number }>(),
  ]);
  return {
    totalUsers: users?.n ?? 0,
    activeUsersLast30Days: activeUsers?.n ?? 0,
    totalReports: reports?.n ?? 0,
    reportsToday: reportsToday?.n ?? 0,
    totalStorageBytes: storage?.n ?? 0,
    scannerVersions: versions.results,
  };
}

export async function listAuditLogs(db: D1Database, limit = 100): Promise<{ id: string; user_id: string | null; action: string; metadata: string | null; created_at: string }[]> {
  const { results } = await db
    .prepare('SELECT id, user_id, action, metadata, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<{ id: string; user_id: string | null; action: string; metadata: string | null; created_at: string }>();
  return results;
}

export async function createMagicLink(db: D1Database, email: string, tokenHash: string, expiresAt: string): Promise<void> {
  await db
    .prepare('INSERT INTO magic_links (token_hash, email, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, email, expiresAt)
    .run();
}

export async function consumeMagicLink(db: D1Database, tokenHash: string): Promise<{ email: string } | null> {
  const row = await db
    .prepare('SELECT email, expires_at, used_at FROM magic_links WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ email: string; expires_at: string; used_at: string | null }>();
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return null;
  await db.prepare('UPDATE magic_links SET used_at = datetime(\'now\') WHERE token_hash = ?').bind(tokenHash).run();
  return { email: row.email };
}

export async function createScanToken(db: D1Database, tokenHash: string, userId: string, expiresAt: string): Promise<void> {
  await db
    .prepare('INSERT INTO scan_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, expiresAt)
    .run();
}

/** Single use: resolving the token also burns it, exactly like
 * consumeMagicLink. Returns the owning user or null for an unknown,
 * expired, or already-used token. */
export async function consumeScanToken(db: D1Database, tokenHash: string): Promise<UserRow | null> {
  const row = await db
    .prepare(
      `SELECT users.*, scan_tokens.expires_at AS token_expires_at, scan_tokens.used_at AS token_used_at
       FROM scan_tokens JOIN users ON users.id = scan_tokens.user_id
       WHERE scan_tokens.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<UserRow & { token_expires_at: string; token_used_at: string | null }>();
  if (!row || row.token_used_at || new Date(row.token_expires_at) < new Date()) return null;
  await db.prepare('UPDATE scan_tokens SET used_at = datetime(\'now\') WHERE token_hash = ?').bind(tokenHash).run();
  const user: Record<string, unknown> = { ...row };
  delete user.token_expires_at;
  delete user.token_used_at;
  return user as unknown as UserRow;
}

export async function createSession(db: D1Database, sessionIdHash: string, userId: string, expiresAt: string): Promise<void> {
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(sessionIdHash, userId, expiresAt).run();
}

export async function findSessionUser(db: D1Database, sessionIdHash: string): Promise<UserRow | null> {
  const row = await db
    .prepare(
      `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > datetime('now')`,
    )
    .bind(sessionIdHash)
    .first<UserRow>();
  return row ?? null;
}

export async function deleteSession(db: D1Database, sessionIdHash: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionIdHash).run();
}

export async function upsertDevice(
  db: D1Database,
  userId: string,
  device: { name: string; platform: Platform; osVersion?: string; model?: string },
): Promise<DeviceRow> {
  const existing = await db
    .prepare('SELECT * FROM devices WHERE user_id = ? AND name = ? AND platform = ?')
    .bind(userId, device.name, device.platform)
    .first<DeviceRow>();
  if (existing) {
    await db
      .prepare('UPDATE devices SET os_version = ?, model = ? WHERE id = ?')
      .bind(device.osVersion ?? null, device.model ?? null, existing.id)
      .run();
    return { ...existing, os_version: device.osVersion ?? null, model: device.model ?? null };
  }
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO devices (id, user_id, name, platform, os_version, model) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, device.name, device.platform, device.osVersion ?? null, device.model ?? null)
    .run();
  return { id, user_id: userId, name: device.name, platform: device.platform, os_version: device.osVersion ?? null, model: device.model ?? null, created_at: new Date().toISOString() };
}

export async function listDevices(db: D1Database, userId: string): Promise<DeviceRow[]> {
  const { results } = await db.prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all<DeviceRow>();
  return results;
}

export async function insertReport(db: D1Database, row: ReportRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO reports (id, user_id, device_id, schema_version, scanner_version, r2_key, used_bytes, total_bytes, reclaimable_bytes, collected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, row.user_id, row.device_id, row.schema_version, row.scanner_version, row.r2_key, row.used_bytes, row.total_bytes, row.reclaimable_bytes, row.collected_at)
    .run();
}

/** `asAdmin: true` drops the ownership filter — callers must have already
 * checked `canAccessOwnedResource` / an admin-level permission before
 * passing it (see worker/lib/rbac.ts). Never derived from user input. */
export async function getReport(db: D1Database, userId: string, reportId: string, asAdmin = false): Promise<ReportRow | null> {
  const row = asAdmin
    ? await db.prepare('SELECT * FROM reports WHERE id = ?').bind(reportId).first<ReportRow>()
    : await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind(reportId, userId).first<ReportRow>();
  return row ?? null;
}

export async function listReports(db: D1Database, userId: string, deviceId?: string, limit = 100, asAdmin = false): Promise<ReportRow[]> {
  let query;
  if (asAdmin) {
    query = deviceId
      ? db.prepare('SELECT * FROM reports WHERE device_id = ? ORDER BY collected_at DESC LIMIT ?').bind(deviceId, limit)
      : db.prepare('SELECT * FROM reports ORDER BY collected_at DESC LIMIT ?').bind(limit);
  } else {
    query = deviceId
      ? db.prepare('SELECT * FROM reports WHERE user_id = ? AND device_id = ? ORDER BY collected_at DESC LIMIT ?').bind(userId, deviceId, limit)
      : db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY collected_at DESC LIMIT ?').bind(userId, limit);
  }
  const { results } = await query.all<ReportRow>();
  return results;
}

export async function getApiKey(db: D1Database, userId: string, provider: string): Promise<ApiKeyRow | null> {
  const row = await db.prepare('SELECT * FROM api_keys WHERE user_id = ? AND provider = ?').bind(userId, provider).first<ApiKeyRow>();
  return row ?? null;
}

export async function listApiKeys(db: D1Database, userId: string): Promise<Pick<ApiKeyRow, 'id' | 'provider' | 'created_at'>[]> {
  const { results } = await db.prepare('SELECT id, provider, created_at FROM api_keys WHERE user_id = ?').bind(userId).all<Pick<ApiKeyRow, 'id' | 'provider' | 'created_at'>>();
  return results;
}

export async function upsertApiKey(db: D1Database, userId: string, provider: string, ciphertext: string, iv: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO api_keys (id, user_id, provider, encrypted_key, iv) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider) DO UPDATE SET encrypted_key = excluded.encrypted_key, iv = excluded.iv`,
    )
    .bind(crypto.randomUUID(), userId, provider, ciphertext, iv)
    .run();
}

export async function deleteApiKey(db: D1Database, userId: string, provider: string): Promise<void> {
  await db.prepare('DELETE FROM api_keys WHERE user_id = ? AND provider = ?').bind(userId, provider).run();
}

export async function getSettings(db: D1Database, userId: string): Promise<SettingsRow | null> {
  const row = await db.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId).first<SettingsRow>();
  return row ?? null;
}

export async function upsertSettings(db: D1Database, userId: string, provider: string | null, model: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (user_id, preferred_ai_provider, preferred_ai_model) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET preferred_ai_provider = excluded.preferred_ai_provider, preferred_ai_model = excluded.preferred_ai_model, updated_at = datetime('now')`,
    )
    .bind(userId, provider, model)
    .run();
}

export async function recordAudit(db: D1Database, userId: string | null, action: string, metadata?: Record<string, unknown>): Promise<void> {
  await db
    .prepare('INSERT INTO audit_logs (id, user_id, action, metadata) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, action, metadata ? JSON.stringify(metadata) : null)
    .run();
}
