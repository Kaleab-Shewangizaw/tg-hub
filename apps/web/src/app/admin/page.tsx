import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Bars } from '@/components/admin/Bars';
import { ago, fmt } from '@/components/admin/format';
import { LogList } from '@/components/admin/LogList';
import { Avatar } from '@/components/Avatar';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireAdmin } from '@/server/auth';
import { config } from '@/server/config';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Overview' };

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={3} />}>
      <Overview />
    </Suspense>
  );
}

const STATUS_LABEL: Record<string, string> = { active: 'Tracking', pending: 'Pending', needs_attention: 'Needs attention', disconnected: 'Disconnected' };

async function Overview() {
  await requireAdmin();
  const s = repo.adminStats(config.adminEmails);
  const signups = repo.adminDailySeries('signups', 30);
  const posts = repo.adminDailySeries('posts', 30);
  const newest = repo.adminListUsers({ sort: 'joined', limit: 6 }).rows;
  const log = repo.listAdminLog({ limit: 6 });
  const statuses = Object.entries(s.channelsByStatus).sort((a, b) => b[1] - a[1]);

  const kpis = [
    { label: 'People', value: s.users, note: `+${fmt(s.newUsers7d)} this week`, href: '/admin/users' },
    { label: 'Active this week', value: s.active7d, note: s.users ? `${Math.round((s.active7d / s.users) * 100)}% of everyone` : '—' },
    { label: 'Creators', value: s.creators, note: `${fmt(s.channels)} channels`, href: '/admin/users?filter=creators' },
    { label: 'Posts this week', value: s.posts7d, note: `${fmt(s.posts)} all time` },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>
            Overview
          </h1>
        </div>
        <div className="page-head-meta">
          <Link href="/admin/users" className="btn btn-sm">
            Manage people
          </Link>
        </div>
      </div>

      <section className="adm-kpis" aria-label="Key numbers">
        {kpis.map((k) => {
          const body = (
            <>
              <p className="tile-label">{k.label}</p>
              <p className="adm-kpi-num">{fmt(k.value)}</p>
              <p className="faint small">{k.note}</p>
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="adm-kpi is-link">
              {body}
            </Link>
          ) : (
            <div key={k.label} className="adm-kpi">
              {body}
            </div>
          );
        })}
      </section>

      <div className="adm-cols">
        <section className="panel" aria-labelledby="signups-h">
          <div className="panel-head">
            <h2 id="signups-h" className="panel-title">
              Sign-ups
            </h2>
            <p className="panel-sub mono">{fmt(s.newUsers30d)} in 30 days</p>
          </div>
          <Bars series={signups} label="Sign-ups" unit="sign-ups" />
        </section>
        <section className="panel" aria-labelledby="posts-h">
          <div className="panel-head">
            <h2 id="posts-h" className="panel-title">
              Posts tracked
            </h2>
            <p className="panel-sub mono">{fmt(s.posts30d)} in 30 days</p>
          </div>
          <Bars series={posts} label="Posts" unit="posts" />
        </section>
      </div>

      <div className="adm-cols">
        <section className="panel" aria-labelledby="newest-h">
          <div className="panel-head">
            <h2 id="newest-h" className="panel-title">
              Newest people
            </h2>
            <Link href="/admin/users" className="link-arrow">
              All people
            </Link>
          </div>
          {newest.length === 0 ? (
            <p className="empty">No accounts yet.</p>
          ) : (
            <ul className="adm-list">
              {newest.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="adm-list-row">
                    <Avatar name={u.name} seed={u.handle} size={34} />
                    <span className="adm-who">
                      <strong>{u.name}</strong>
                      <span className="faint small">{u.email}</span>
                    </span>
                    <span className="faint small mono">{ago(u.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="stack">
          <section className="panel" aria-labelledby="health-h">
            <div className="panel-head">
              <h2 id="health-h" className="panel-title">
                Health
              </h2>
            </div>
            <dl className="adm-facts">
              {statuses.map(([status, n]) => (
                <div key={status}>
                  <dt>{STATUS_LABEL[status] ?? status} channels</dt>
                  <dd className="mono">{fmt(n)}</dd>
                </div>
              ))}
              <div>
                <dt>Unclaimed channels</dt>
                <dd className="mono">{fmt(s.unclaimedChannels)}</dd>
              </div>
              <div>
                <dt>Signed-in sessions</dt>
                <dd className="mono">{fmt(s.activeSessions)}</dd>
              </div>
              <div>
                <dt>Reminders sent this week</dt>
                <dd className="mono">{fmt(s.remindersSent7d)}</dd>
              </div>
              <div>
                <dt>Follows · stars</dt>
                <dd className="mono">
                  {fmt(s.follows)} · {fmt(s.stars)}
                </dd>
              </div>
              <div>
                <dt>Admins · suspended</dt>
                <dd className="mono">
                  {fmt(s.admins)} · {fmt(s.suspended)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel" aria-labelledby="log-h">
            <div className="panel-head">
              <h2 id="log-h" className="panel-title">
                Recent admin activity
              </h2>
              <Link href="/admin/log" className="link-arrow">
                Full log
              </Link>
            </div>
            <LogList entries={log} />
          </section>
        </div>
      </div>
    </>
  );
}
