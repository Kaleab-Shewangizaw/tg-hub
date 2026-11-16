import type { Metadata } from 'next';
import { Suspense } from 'react';
import { removeBotAction, webhookInfo } from '@/app/actions/bot';
import { ConfirmSubmit } from '@/components/admin/AdminForms';
import { BotStatusRows } from '@/components/admin/BotStatus';
import { DeliveryForm, RunRemindersButton, TestMessageButton, TokenForm } from '@/components/admin/BotForms';
import { ago } from '@/components/admin/format';
import { PanelSkeleton } from '@/components/Skeletons';
import { requireAdmin } from '@/server/auth';
import { botSettings, KEYS } from '@/server/botSettings';
import { config } from '@/server/config';
import * as repo from '@/server/repo';

export const metadata: Metadata = { title: 'Bot' };

export default function AdminBotPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Telegram bot</h1>
          <p className="page-head-desc">The bot verifies channels, records posts and reactions, and sends reminders and medal messages.</p>
        </div>
      </div>
      <Suspense fallback={<PanelSkeleton rows={2} />}>
        <Bot />
      </Suspense>
    </>
  );
}

async function Bot() {
  const admin = await requireAdmin();
  const s = botSettings();
  const connected = !!s.botToken;
  const hook = connected && s.delivery === 'webhook' ? await webhookInfo() : null;
  const lastPoll = repo.getAppSetting(KEYS.lastPoll);
  const pollError = repo.getAppSetting(KEYS.lastPollError);
  const lastRun = (() => {
    try {
      return JSON.parse(repo.getAppSetting(KEYS.lastReminderRun) ?? 'null') as { at: string; sent: number; checked: number } | null;
    } catch {
      return null;
    }
  })();
  const linked = repo.countTelegramLinked();

  const rows: { label: string; value: string; tone?: 'ok' | 'warn' }[] = [
    { label: 'Bot', value: connected ? (s.botUsername ? `@${s.botUsername}` : 'Connected') : 'Not connected', tone: connected ? 'ok' : 'warn' },
    { label: 'Mode', value: connected ? 'Live' : 'Development (simulator)' },
    { label: 'Updates', value: s.delivery === 'webhook' ? 'Webhook' : 'Polling from this server' },
  ];
  if (connected && s.delivery === 'polling') {
    rows.push(pollError ? { label: 'Last poll', value: pollError, tone: 'warn' } : { label: 'Last poll', value: lastPoll ? ago(lastPoll) : 'Starting…', tone: lastPoll ? 'ok' : undefined });
  }
  if (hook) {
    rows.push({ label: 'Webhook', value: hook.url || 'Not registered', tone: hook.url ? 'ok' : 'warn' });
    if (hook.lastError) rows.push({ label: 'Last webhook error', value: hook.lastError, tone: 'warn' });
    if (hook.pending) rows.push({ label: 'Waiting updates', value: String(hook.pending) });
  }
  rows.push({ label: 'Reminder job', value: lastRun ? `${ago(lastRun.at)} · ${lastRun.sent} sent` : 'Runs every 5 minutes while the bot is live' });
  rows.push({ label: 'Your Telegram', value: admin.telegramUserId ? `Linked${admin.telegramName ? ` as ${admin.telegramName}` : ''}` : 'Not linked (needed for test messages)', tone: admin.telegramUserId ? 'ok' : undefined });

  return (
    <div className="adm-cols">
      <div className="stack">
        <section className="panel" aria-labelledby="status-h">
          <div className="panel-head">
            <h2 id="status-h" className="panel-title">
              Status
            </h2>
          </div>
          <BotStatusRows rows={rows} />
          {connected ? (
            <div className="adm-inline-actions">
              <TestMessageButton />
              <RunRemindersButton />
            </div>
          ) : null}
        </section>

        <section className="panel" aria-labelledby="msgs-h">
          <div className="panel-head">
            <h2 id="msgs-h" className="panel-title">
              What the bot sends
            </h2>
          </div>
          <ul className="bot-msgs">
            <li>
              <strong>Daily reminder</strong>
              <span className="small muted">At most one a day, at each person’s chosen time, only if their goal isn’t met yet and never in quiet hours.</span>
            </li>
            <li>
              <strong>New medal</strong>
              <span className="small muted">When someone earns a medal or a higher tier (×2, ×3, ×4). People can turn this off in Settings.</span>
            </li>
            <li>
              <strong>Account linked</strong>
              <span className="small muted">A confirmation when someone presses Start from their Tally link.</span>
            </li>
          </ul>
          <p className="faint small">Messages only reach people who linked their Telegram account: {linked} {linked === 1 ? 'person' : 'people'} so far.</p>
        </section>
      </div>

      <div className="stack">
        <section className="panel" aria-labelledby="token-h">
          <div className="panel-head">
            <h2 id="token-h" className="panel-title">
              {connected ? 'Bot token' : 'Connect your bot'}
            </h2>
          </div>
          {!connected ? (
            <ol className="howto bot-steps">
              <li>
                Open <strong>@BotFather</strong> in Telegram and send <span className="code">/newbot</span>.
              </li>
              <li>Pick a name and a username ending in “bot”.</li>
              <li>Copy the token it gives you and paste it below.</li>
            </ol>
          ) : null}
          {s.fromEnv.botToken ? (
            <p className="small muted">Set by TELEGRAM_BOT_TOKEN in the server environment. Remove it there to manage the bot here.</p>
          ) : (
            <TokenForm connected={connected} locked={false} />
          )}
          {connected && !s.fromEnv.botToken ? (
            <form action={removeBotAction} className="adm-remove-bot">
              <ConfirmSubmit message="Disconnect the bot? Tracking, reminders and medal messages stop until you connect one again." className="btn btn-sm btn-ghost btn-warn">
                Disconnect bot
              </ConfirmSubmit>
            </form>
          ) : null}
          <p className="faint small">The token is stored in this server’s database and only admins can change it. Anyone with the token controls the bot, so keep it private.</p>
        </section>

        {connected ? (
          <section className="panel" aria-labelledby="delivery-h">
            <div className="panel-head">
              <h2 id="delivery-h" className="panel-title">
                How updates arrive
              </h2>
            </div>
            <DeliveryForm current={s.delivery} httpsReady={config.appUrl.startsWith('https://')} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
