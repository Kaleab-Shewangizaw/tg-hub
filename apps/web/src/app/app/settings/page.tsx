import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { runRemindersNowAction } from '@/app/actions/channels';
import { SettingsForm } from '@/components/SettingsForm';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireUser } from '@/server/auth';
import { telegramMode } from '@/server/config';
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
    <>
      <div className="page-head rise">
        <div>
          <p className="eyebrow">Your rhythm</p>
          <h1>Settings</h1>
        </div>
      </div>

      {mode === 'live' && !user.telegramUserId && user.settings.reminders.enabled ? (
        <p className="banner banner-amber" style={{ maxWidth: 760 }}>
          Reminders need a linked Telegram account. <Link href="/app/channels">Link it</Link>
        </p>
      ) : null}

      <SettingsForm initial={user.settings} />

      {last ? (
        <p className="faint small">
          Last reminder · {last.localDate} · {last.status === 'sent' ? 'delivered' : last.status.replace('_', ' ')}
        </p>
      ) : null}

      {mode === 'development' ? (
        <section className="panel" style={{ maxWidth: 760 }} aria-labelledby="sim-h">
          <div className="panel-head">
            <h2 id="sim-h" className="panel-title">
              Simulated chat
            </h2>
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
    </>
  );
}
