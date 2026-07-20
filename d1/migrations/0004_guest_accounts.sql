-- Lets a first-time visitor scan and see results before ever giving an
-- email — see docs/RBAC.md §Guest accounts. A guest is a real row in
-- `users` (role='user', a non-deliverable placeholder email) rather than
-- a parallel identity system: every route, permission check, and
-- ownership rule that already exists for a signed-in user works
-- unchanged for a guest, for free.
ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_users_is_guest ON users(is_guest);
