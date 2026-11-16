import { isAdmin } from '@/server/auth';
import type { AdminUserRow } from '@/server/repo';

export function StatusBadges({ u }: { u: Pick<AdminUserRow, 'role' | 'email' | 'suspendedAt' | 'profilePublic' | 'channels'> }) {
  return (
    <span className="adm-badges">
      {u.suspendedAt ? <span className="chip chip-amber">Suspended</span> : null}
      {isAdmin(u) ? <span className="chip chip-accent">Admin</span> : null}
      {u.channels > 0 ? <span className="chip chip-mint">Creator</span> : null}
      {!u.profilePublic ? <span className="chip chip-outline">Private</span> : null}
      {!u.suspendedAt && !isAdmin(u) && u.channels === 0 && u.profilePublic ? <span className="chip">Member</span> : null}
    </span>
  );
}
