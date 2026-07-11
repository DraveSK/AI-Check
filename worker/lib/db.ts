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
  created_at: string;
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

export async function findOrCreateUser(db: D1Database, email: string): Promise<UserRow> {
  const existing = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (existing) return existing;
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(id, email).run();
  return { id, email, created_at: new Date().toISOString() };
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

export async function getReport(db: D1Database, userId: string, reportId: string): Promise<ReportRow | null> {
  const row = await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind(reportId, userId).first<ReportRow>();
  return row ?? null;
}

export async function listReports(db: D1Database, userId: string, deviceId?: string, limit = 100): Promise<ReportRow[]> {
  const query = deviceId
    ? db.prepare('SELECT * FROM reports WHERE user_id = ? AND device_id = ? ORDER BY collected_at DESC LIMIT ?').bind(userId, deviceId, limit)
    : db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY collected_at DESC LIMIT ?').bind(userId, limit);
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
