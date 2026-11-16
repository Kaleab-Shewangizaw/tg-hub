import 'server-only';
import type { TgUpdate } from '@emberly/telegram';
import { botSettings, KEYS, telegramMode } from './botSettings';
import { runReminderJob } from './reminders';
import * as repo from './repo';
import { handleTelegramUpdate } from './telegram';

/**
 * Work that runs inside the server process, started from instrumentation.ts:
 *  - Reminder job every 5 minutes (also safe alongside an external cron).
 *  - When delivery is "polling", a long-poll loop that reads updates from
 *    Telegram (no public URL needed). Settings are re-read every round, so
 *    switching bot or delivery in Admin → Bot takes effect without a restart.
 * Disable with TALLY_BACKGROUND=off (e.g. when running several instances).
 */

const REMINDER_EVERY_MS = 5 * 60_000;
const ALLOWED = ['message', 'channel_post', 'edited_channel_post', 'message_reaction_count', 'my_chat_member'];
const g = globalThis as unknown as { __tallyBackground?: boolean };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startBackground() {
  if (g.__tallyBackground || process.env.TALLY_BACKGROUND === 'off') return;
  g.__tallyBackground = true;
  void reminderLoop();
  void pollLoop();
  console.log('[tally] background worker started (reminders every 5 min, Telegram polling when enabled)');
}

async function reminderLoop() {
  await sleep(20_000);
  for (;;) {
    try {
      if (telegramMode() === 'live') {
        const summary = await runReminderJob(new Date());
        repo.setAppSetting(KEYS.lastReminderRun, JSON.stringify({ at: new Date().toISOString(), sent: summary.sent, checked: summary.checked, failed: summary.failed }));
      }
    } catch (e) {
      console.error('[tally] reminder job failed', e);
    }
    await sleep(REMINDER_EVERY_MS);
  }
}

async function tg<T>(token: string, method: string, body: object): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  });
  return res.json();
}

async function pollLoop() {
  let offset = 0;
  let token: string | null = null;
  for (;;) {
    const s = botSettings();
    if (!s.botToken || s.delivery !== 'polling') {
      await sleep(5_000);
      continue;
    }
    if (s.botToken !== token) {
      token = s.botToken;
      offset = 0;
    }
    try {
      const r = await tg<TgUpdate[]>(token, 'getUpdates', { offset, timeout: 25, allowed_updates: ALLOWED });
      if (!r.ok) {
        // 409: a webhook is set, or another process is polling this bot.
        repo.setAppSetting(KEYS.lastPollError, `${r.error_code ?? ''} ${r.description ?? 'getUpdates failed'}`.trim());
        await sleep(r.error_code === 401 ? 60_000 : 10_000);
        continue;
      }
      repo.setAppSetting(KEYS.lastPoll, new Date().toISOString());
      repo.setAppSetting(KEYS.lastPollError, null);
      for (const update of r.result ?? []) {
        try {
          await handleTelegramUpdate(update, 'live');
        } catch (e) {
          console.error('[tally] update failed', update.update_id, e);
        }
        offset = update.update_id + 1;
      }
    } catch (e) {
      repo.setAppSetting(KEYS.lastPollError, e instanceof Error ? e.message : 'Network error');
      await sleep(10_000);
    }
  }
}
