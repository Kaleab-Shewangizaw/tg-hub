import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { revokeSessionsAction, setRoleAction, setSuspendedAction } from '@/app/actions/admin';
import { ChannelsTable } from '@/components/admin/ChannelsTable';
import { ConfirmSubmit, DeleteUserForm, EditUserForm } from '@/components/admin/AdminForms';
import { ago, day, fmt } from '@/components/admin/format';
import { LogList } from '@/components/admin/LogList';
import { StatusBadges } from '@/components/admin/StatusBadges';
import { Avatar } from '@/components/Avatar';
import { PanelSkeleton } from '@/components/Skeletons';
import { config } from '@/server/config';
import { isAdmin, requireAdmin } from '@/server/auth';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Person' };

export default function AdminUserPage({ params }: PageProps<'/admin/users/[id]'>) {
  return (
    <Suspense fallback={<PanelSkeleton rows={3} />}>
      <Person params={params} />
    </Suspense>
  );
}

async function Person({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const user = repo.getUser(id);
  if (!user) notFound();

  const self = user.id === me.id;
  const viaEnv = config.adminEmails.has(user.email.toLowerCase());
  const admin = isAdmin(user);
  const channels = repo.adminListChannels({ userId: user.id });
  const sessions = repo.listUserSessions(user.id);
  const follows = repo.followCounts(user.id);
  const posts = channels.reduce((a, c) => a + c.posts, 0);
  const lastPost = channels.map((c) => c.lastPostAt).filter(Boolean).sort().at(-1) ?? null;
  const history = repo.listAdminLog({ targetId: user.id, limit: 20 });
  const s = user.settings;
  const goal = s.cadence.kind === 'weekly' ? `${s.cadence.postsPerWeek} posts a week` : s.cadence.kind === 'daily' ? `${s.cadence.postsPerDay} a day` : `${s.cadence.postsPerDay} a day on ${s.cadence.days.length} set days`;

  return (
    <>
      <p>
        <Link href="/admin/users" className="link-arrow">
          ← All people
        </Link>
      </p>

      <div className="adm-person-head">
        <Avatar name={user.name} seed={user.handle} size={72} />
        <div className="adm-person-names">
          <h1>
            {user.name}
            {self ? <span className="faint"> (you)</span> : null}
          </h1>
          <p className="muted">
            @{user.handle} · {user.email}
          </p>
          <StatusBadges u={{ ...user, channels: channels.length }} />
        </div>
        {user.profilePublic && !user.suspendedAt ? (
          <Link href={`/u/${user.handle}`} className="btn btn-ghost btn-sm">
            Public profile
          </Link>
        ) : null}
      </div>

      <dl className="adm-kpis is-compact">
        {[
          ['Joined', day(user.createdAt)],
          ['Last seen', ago(user.lastSeenAt)],
          ['Posts', fmt(posts)],
          ['Last post', ago(lastPost)],
          ['Followers', fmt(follows.followers)],
          ['Following', fmt(follows.following)],
        ].map(([k, v]) => (
          <div key={k} className="adm-kpi">
            <dt className="tile-label">{k}</dt>
            <dd className="adm-kpi-num is-sm">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="adm-cols">
        <div className="stack">
          <section className="panel" aria-labelledby="edit-h">
            <div className="panel-head">
              <h2 id="edit-h" className="panel-title">
                Account
              </h2>
            </div>
            <EditUserForm user={user} />
          </section>

          <section className="panel" aria-labelledby="about-h">
            <div className="panel-head">
              <h2 id="about-h" className="panel-title">
                Details
              </h2>
            </div>
            <dl className="adm-facts">
              <div>
                <dt>Bio</dt>
                <dd>{user.bio ?? <span className="faint">None</span>}</dd>
              </div>
              <div>
                <dt>Profile</dt>
                <dd>{user.profilePublic ? 'Public' : 'Private'}</dd>
              </div>
              <div>
                <dt>Telegram</dt>
                <dd>{user.telegramName ?? <span className="faint">Not linked</span>}</dd>
              </div>
              <div>
                <dt>Goal</dt>
                <dd>{goal}</dd>
              </div>
              <div>
                <dt>Time zone</dt>
                <dd>{s.timeZone}</dd>
              </div>
              <div>
                <dt>Reminders</dt>
                <dd>{s.reminders.enabled ? `On, at ${s.reminders.time}` : 'Off'}</dd>
              </div>
              <div>
                <dt>User ID</dt>
                <dd className="mono small">{user.id}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="access-h">
            <div className="panel-head">
              <h2 id="access-h" className="panel-title">
                Access
              </h2>
            </div>
            {self ? <p className="small muted adm-note">You can’t change your own access. Ask another admin.</p> : null}
            <ul className="adm-actions">
              <li>
                <div>
                  <p className="adm-action-title">Admin rights</p>
                  <p className="small muted">
                    {viaEnv ? 'Granted by ADMIN_EMAILS in the server environment.' : admin ? 'Can open this admin area and manage everyone.' : 'A regular account.'}
                  </p>
                </div>
                {self || viaEnv ? null : (
                  <form action={setRoleAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="role" value={admin ? 'user' : 'admin'} />
                    <ConfirmSubmit message={admin ? `Remove admin rights from ${user.name}?` : `Give ${user.name} full admin access?`}>
                      {admin ? 'Remove admin' : 'Make admin'}
                    </ConfirmSubmit>
                  </form>
                )}
              </li>
              <li>
                <div>
                  <p className="adm-action-title">Sessions</p>
                  <p className="small muted">
                    {sessions.length === 0
                      ? 'Not signed in anywhere.'
                      : `Signed in on ${sessions.length} ${sessions.length === 1 ? 'device' : 'devices'}: ${sessions.map((x) => `${x.kind} (${ago(x.createdAt)})`).join(', ')}.`}
                  </p>
                </div>
                {self || sessions.length === 0 ? null : (
                  <form action={revokeSessionsAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <ConfirmSubmit message={`Sign ${user.name} out on every device?`}>Sign out everywhere</ConfirmSubmit>
                  </form>
                )}
              </li>
              <li>
                <div>
                  <p className="adm-action-title">{user.suspendedAt ? `Suspended ${ago(user.suspendedAt)}` : 'Suspension'}</p>
                  <p className="small muted">
                    {user.suspendedAt
                      ? 'They can’t sign in, and their public profile is hidden until reinstated.'
                      : admin
                        ? 'Remove admin rights before suspending.'
                        : 'Blocks sign-in, signs them out everywhere and hides their public profile. Nothing is deleted.'}
                  </p>
                </div>
                {self || (admin && !user.suspendedAt) ? null : (
                  <form action={setSuspendedAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="suspend" value={user.suspendedAt ? '0' : '1'} />
                    <ConfirmSubmit
                      message={user.suspendedAt ? `Reinstate ${user.name}?` : `Suspend ${user.name}? They’ll be signed out immediately.`}
                      className={user.suspendedAt ? 'btn btn-sm' : 'btn btn-sm btn-ghost btn-warn'}
                    >
                      {user.suspendedAt ? 'Reinstate' : 'Suspend'}
                    </ConfirmSubmit>
                  </form>
                )}
              </li>
            </ul>
          </section>

          <section className="panel" aria-labelledby="hist-h">
            <div className="panel-head">
              <h2 id="hist-h" className="panel-title">
                Admin history
              </h2>
            </div>
            <LogList entries={history} />
          </section>
        </div>
      </div>

      <section className="panel" aria-labelledby="ch-h">
        <div className="panel-head">
          <h2 id="ch-h" className="panel-title">
            Channels
          </h2>
          <p className="panel-sub mono">{channels.length}</p>
        </div>
        <ChannelsTable channels={channels} showOwner={false} empty="No channels connected." />
      </section>

      {self ? null : (
        <section className="panel adm-danger" aria-labelledby="danger-h">
          <div className="panel-head">
            <h2 id="danger-h" className="panel-title">
              Delete account
            </h2>
          </div>
          <DeleteUserForm userId={user.id} handle={user.handle} />
        </section>
      )}
    </>
  );
}
