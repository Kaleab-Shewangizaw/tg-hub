import Link from 'next/link';
import type { AdminLogEntry } from '@/server/repo';
import { ago } from './format';

export function LogList({ entries }: { entries: AdminLogEntry[] }) {
  if (entries.length === 0) return <p className="empty">Nothing yet. Every change made in admin is recorded here.</p>;
  return (
    <ol className="adm-log">
      {entries.map((e) => {
        // Channels and deleted accounts have no page to link to.
        const linkable = e.targetId && !/channel|deleted/i.test(e.action);
        return (
          <li key={e.id}>
            <p>
              <strong>{e.adminName}</strong> <span className="muted">{e.action.toLowerCase()}</span>{' '}
              {e.targetLabel ? linkable ? <Link href={`/admin/users/${e.targetId}`}>{e.targetLabel}</Link> : <span>{e.targetLabel}</span> : null}
            </p>
            <p className="faint small">
              {ago(e.createdAt)}
              {e.detail ? ` · ${e.detail}` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
