-- Adds role-based access control fields to users. Additive only — see
-- SCHEMA.md's discipline applied to this table too: no column is renamed
-- or removed, existing rows get sensible defaults.
--
-- No new tables: `role` and `status` are columns, not separate tables,
-- because there are exactly four roles (guest is implicit — "no session"
-- — never a stored row) and two statuses. A roles/permissions table pair
-- would be the right call if roles were user-editable or numerous; here
-- they're a fixed enum defined in code (worker/lib/rbac.ts) — see
-- docs/RBAC.md "why roles are a column, not a table."

ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN avatar TEXT;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'));
ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE users ADD COLUMN last_login TEXT;

CREATE INDEX idx_users_role ON users(role);
