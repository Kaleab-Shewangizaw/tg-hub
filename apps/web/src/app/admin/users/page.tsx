import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ago, day, fmt } from '@/components/admin/format';
import { Avatar } from '@/components/Avatar';
import { PanelSkeleton } from '@/components/Skeletons';
import { StatusBadges } from '@/components/admin/StatusBadges';
import { requireAdmin } from '@/server/auth';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'People' };

const PAGE = 50;

const FILTERS: { id: repo.AdminUserFilter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'creators', label: 'Creators' },
  { id: 'no-channel', label: 'No channel yet' },
  { id: 'admins', label: 'Admins' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'private', label: 'Private profiles' },
];

const SORTS: { id: repo.AdminUserSort; label: string }[] = [
  { id: 'joined', label: 'Newest' },
  { id: 'seen', label: 'Last seen' },
  { id: 'posts', label: 'Most posts' },
  { id: 'followers', label: 'Most followers' },
  { id: 'name', label: 'Name' },
];

type Search = { q?: string; filter?: string; sort?: string; page?: string };

export default function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>People</h1>
          <p className="page-head-desc">Everyone with an account: who they are, what they’ve connected and how active they are.</p>
        </div>
      </div>
      <Suspense fallback={<PanelSkeleton rows={1} />}>
        <Users searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

function pick<T extends string>(value: unknown, options: { id: T }[], fallback: T): T {
  return options.some((o) => o.id === value) ? (value as T) : fallback;
}

async function Users({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 80) : '';
  const filter = pick(sp.filter, FILTERS, 'all');
  const sort = pick(sp.sort, SORTS, 'joined');
  const page = Math.max(1, Number.parseInt(String(sp.page ?? '1'), 10) || 1);
  const { rows, total } = repo.adminListUsers({ q, filter, sort, dir: sort === 'name' ? 'asc' : 'desc', limit: PAGE, offset: (page - 1) * PAGE });
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const next = { q, filter, sort, page: '1', ...patch };
    if (next.q) p.set('q', next.q);
    if (next.filter !== 'all') p.set('filter', next.filter);
    if (next.sort !== 'joined') p.set('sort', next.sort);
    if (next.page !== '1') p.set('page', next.page);
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ''}`;
  };

  return (
    <div className="stack">
      <div className="adm-toolbar">
        <nav className="adm-filters" aria-label="Filter people">
          {FILTERS.map((f) => (
            <Link key={f.id} href={href({ filter: f.id })} aria-current={f.id === filter ? 'true' : undefined}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="adm-search" action="/admin/users" role="search">
          {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
          <input type="search" name="q" className="input" defaultValue={q} placeholder="Search name, email or handle" aria-label="Search people" />
          <select name="sort" className="input" defaultValue={sort} aria-label="Sort by">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-sm">
            Apply
          </button>
        </form>
      </div>

      <section className="panel adm-table-panel">
        <p className="adm-count mono">
          {fmt(total)} {total === 1 ? 'person' : 'people'}
          {q ? ` matching “${q}”` : ''}
        </p>
        {rows.length === 0 ? (
          <p className="empty">No one matches. Try a different search or filter.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Channels
                  </th>
                  <th scope="col" className="num">
                    Posts
                  </th>
                  <th scope="col" className="num">
                    Followers
                  </th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="adm-person">
                        <Avatar name={u.name} seed={u.handle} size={34} />
                        <span className="adm-who">
                          <strong>
                            {u.name}
                            {u.id === me.id ? <span className="faint"> (you)</span> : null}
                          </strong>
                          <span className="faint small">
                            @{u.handle} · {u.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <StatusBadges u={u} />
                    </td>
                    <td className="num mono">{u.channels}</td>
                    <td className="num mono">{fmt(u.posts)}</td>
                    <td className="num mono">{fmt(u.followers)}</td>
                    <td className="mono small">{day(u.createdAt)}</td>
                    <td className="mono small">{ago(u.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <nav className="adm-pager" aria-label="Pages">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className="btn btn-ghost btn-sm">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="mono small faint">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={href({ page: String(page + 1) })} className="btn btn-ghost btn-sm">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
