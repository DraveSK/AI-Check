-- AI Check — initial production schema (D1 / SQLite)
--
-- Deliberately smaller than the table list a larger platform might use.
-- See docs/ARCHITECTURE.md §Database for what was merged and why:
--   - report_storage    -> reports.r2_key (one pointer column, not a table)
--   - recommendations   -> stored inside the report JSON in R2 (already
--                          part of InspectionReport.cleanup.items)
--   - analysis           -> stored as a companion JSON object in R2
--                          (reports/<id>.analysis.json), not a D1 table
--   - scanner_versions   -> reports.scanner_version (a column; there is
--                          no separate versions-of-the-scanner registry
--                          to maintain yet)
--   - schema_versions    -> reports.schema_version (a column; the
--                          compatibility rules live in SCHEMA.md, not a
--                          database table)
-- Add any of these back as real tables only once there's a concrete need
-- (e.g. an admin UI that lists scanner releases) — see docs/SCANNER_DESIGN.md
-- "What we're deliberately not building yet" for the same reasoning
-- applied to the scanner itself.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-time magic-link tokens. Only a hash is stored — a leaked database
-- row is never enough to sign in as the user. See worker/lib/auth.ts.
CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_magic_links_email ON magic_links(email);

-- Sessions are opaque tokens too — only the hash is stored server-side,
-- the raw token lives only in the user's HttpOnly cookie.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- sha256(session token), hex
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('macos', 'windows', 'linux')),
  os_version TEXT,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name, platform)
);
CREATE INDEX idx_devices_user ON devices(user_id);

-- One row per uploaded scan. The full InspectionReport JSON lives in R2
-- (see worker/lib/r2.ts) — this table is a queryable, indexable summary
-- of it, exactly like the local scanner's HistoryEntry index
-- (docs/HISTORY_FORMAT.md) except server-side and multi-user.
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL,
  scanner_version TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  used_bytes INTEGER NOT NULL,
  total_bytes INTEGER NOT NULL,
  reclaimable_bytes INTEGER NOT NULL,
  collected_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reports_user_collected ON reports(user_id, collected_at DESC);
CREATE INDEX idx_reports_device_collected ON reports(device_id, collected_at DESC);

-- BYO AI provider keys. `encrypted_key`/`iv` are AES-GCM ciphertext —
-- see worker/lib/crypto.ts. The plaintext key exists only transiently in
-- the Worker's memory while it's being used to call the provider; it is
-- never logged and never sent back to the frontend (see docs/SECURITY.md
-- §API key handling).
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'gemini', 'openrouter', 'azure-openai', 'ollama')),
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_ai_provider TEXT,
  preferred_ai_model TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Append-only. `metadata` is a JSON string and must never contain a
-- secret, a key, or file contents — see docs/SECURITY.md §Logging.
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
