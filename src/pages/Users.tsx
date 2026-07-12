import { useEffect, useState } from 'react';
import { Search, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { Card, PageTitle, Pill } from '../components/ui';
import { apiFetch } from '../lib/apiFetch';
import type { CloudUser } from '../hooks/useCloudAuth';
import type { Permission, Role } from '../lib/permissions';

type UserRow = Pick<CloudUser, 'id' | 'email' | 'display_name' | 'avatar' | 'role' | 'status' | 'last_login'> & { created_at: string };

const ROLE_TONE: Record<Role, string> = { user: 'neutral', admin: 'orange', super_admin: 'green' };

/**
 * Admin+ user management — search, view, change role (super_admin only,
 * enforced server-side; this page just hides the control otherwise),
 * enable/disable. See docs/RBAC.md §User management. Reuses the existing
 * `.row`/Card/Pill patterns rather than inventing a table component.
 */
export function UsersPage({ permissions }: { permissions: Permission[] }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canChangeRole = permissions.includes('system.write');
  const canChangeStatus = permissions.includes('users.write');

  async function refresh(query: string) {
    try {
      const rows = await apiFetch<UserRow[]>(`/api/v1/users${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      setUsers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users.');
    }
  }

  useEffect(() => {
    refresh('');
  }, []);

  async function changeRole(userId: string, role: Role) {
    await apiFetch(`/api/v1/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    await refresh(search);
  }

  async function toggleStatus(user: UserRow) {
    const status = user.status === 'active' ? 'disabled' : 'active';
    await apiFetch(`/api/v1/users/${user.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    await refresh(search);
  }

  return (
    <>
      <PageTitle title="Users" copy="Every account on this instance." />
      <Card>
        <div className="card-head">
          <div>
            <h2>All users</h2>
            <p>{users?.length ?? '—'} accounts</p>
          </div>
          <div className="compare-picker">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by email or name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                refresh(e.target.value);
              }}
            />
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}
        {users?.map((u) => (
          <div className="row" key={u.id}>
            <span className="file">
              <span className="row-icon">
                <ShieldCheck size={15} />
              </span>
              {u.display_name || u.email}
              <span className="row-sub">{u.email}</span>
            </span>
            {canChangeRole ? (
              <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)}>
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            ) : (
              <Pill tone={ROLE_TONE[u.role]}>{u.role}</Pill>
            )}
            <Pill tone={u.status === 'active' ? 'green' : 'orange'}>{u.status}</Pill>
            <span className="row-sub">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never signed in'}</span>
            {canChangeStatus && (
              <button className="icon-button" onClick={() => toggleStatus(u)} title={u.status === 'active' ? 'Disable' : 'Enable'}>
                {u.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
              </button>
            )}
          </div>
        ))}
        {users?.length === 0 && <p className="changes-empty">No users match "{search}".</p>}
      </Card>
    </>
  );
}
