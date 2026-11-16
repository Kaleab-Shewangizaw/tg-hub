import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { runRemindersNowAction } from '@/app/actions/channels';
import { MedalMessagesToggle } from '@/components/NotifyToggle';
import { ProfileForm } from '@/components/ProfileForm';
import { SettingsForm } from '@/components/SettingsForm';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireUser } from '@/server/auth';
import { telegramMode } from '@/server/botSettings';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={3} />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const user = await requireUser();
  const mode = telegramMode();
  const outbox = mode === 'development' ? repo.listDevOutbox(user.id, 3) : [];
  const last = repo.recentReminders(user.id, 1)[0];

  return (
    <div className="settings-page">
      <div className="page-head rise">
        <div>
          <h1>Settings</h1>
          <p className="page-head-desc">Your profile, posting goal, reminders and breaks.</p>
        </div>
      </div>

      {mode === 'live' && !user.telegramUserId && user.settings.reminders.enabled ? (
        <p className="banner banner-amber narrow">
          Reminders need a linked Telegram account. <Link href="/app/channels">Link Telegram</Link>
        </p>
      ) : null}

      <div className="settings">
        <ProfileForm initial={{ name: user.name, handle: user.handle, bio: user.bio, profilePublic: user.profilePublic }} />
      </div>

      <SettingsForm initial={user.settings} />

      {last ? (
        <p className="faint small narrow">
          Last reminder: {last.localDate} · {last.status === 'sent' ? 'delivered' : last.status.replace('_', ' ')}
        </p>
      ) : null}

      {mode === 'development' ? (
        <section className="panel narrow" aria-labelledby="sim-h">
          <div className="panel-head">
            <div>
              <h2 id="sim-h" className="panel-title">
                Simulated chat
              </h2>
              <p className="panel-sub">Development only. Reminders land here instead of Telegram.</p>
            </div>
            <form action={runRemindersNowAction}>
              <button className="btn btn-ghost btn-sm" type="submit">
                Run check now
              </button>
            </form>
          </div>
          {outbox.length > 0 ? (
            <ul className="outbox">
              {outbox.map((m) => (
                <li key={m.createdAt}>{m.text}</li>
              ))}
            </ul>
          ) : (
            <p className="faint small">No reminders yet. They arrive after your reminder time if the goal isn’t met.</p>
          )}
        </section>
      ) : null}

      <section className="panel" aria-labelledby="tgmsg-h">
        <h2 id="tgmsg-h" className="panel-title">
          Telegram messages
        </h2>
        <div className="set-toggle-row">
          <div>
            <p className="set-toggle-title">Medal messages</p>
            <p className="small muted">The bot tells you when you earn a medal or reach ×2, ×3, ×4.</p>
          </div>
          <MedalMessagesToggle on={user.notifyMedals} />
        </div>
        {!user.telegramUserId ? (
          <p className="small faint">
            Messages need a linked Telegram account. <Link href="/app/channels">Link Telegram</Link>
          </p>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="more-h">
        <h2 id="more-h" className="panel-title">
          More
        </h2>
        <ul className="set-links">
          <li>
            <Link href="/app/medals">
              <span>
                <strong>Medals</strong>
                <span className="small muted">The medals your posts have earned, and what’s next.</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          </li>
          <li>
            <Link href={`/u/${user.handle}`}>
              <span>
                <strong>Public profile</strong>
                <span className="small muted">See your profile the way others do.</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
