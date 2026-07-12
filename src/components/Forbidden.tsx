import { ShieldAlert } from 'lucide-react';
import { Card, PageTitle } from './ui';

/** Shown instead of a page when the signed-in user's role doesn't hold
 * the required permission — see docs/RBAC.md §Route guards. A dead end,
 * not a redirect: redirecting back to a page the user also can't see
 * (or worse, back to sign-in when they're already signed in) is exactly
 * the redirect-loop failure mode this is designed to avoid. */
export function Forbidden({ page }: { page: string }) {
  return (
    <>
      <PageTitle title={page} copy="You don't have permission to view this page." />
      <Card>
        <p className="changes-empty">
          <ShieldAlert size={16} /> 403 — Ask an admin if you believe this is a mistake.
        </p>
      </Card>
    </>
  );
}
