-- One-time scan tokens for the browser's "Run inspection" flow.
--
-- The dashboard mints a short-lived token (15 min, single use) and embeds
-- it in the downloadable scan script instead of the user's real session
-- token — a file sitting in ~/Downloads must never contain a credential
-- that stays valid for 30 days. Same storage discipline as magic_links
-- and sessions: only the SHA-256 hash is stored, never the raw token.
CREATE TABLE scan_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX idx_scan_tokens_user ON scan_tokens(user_id);
