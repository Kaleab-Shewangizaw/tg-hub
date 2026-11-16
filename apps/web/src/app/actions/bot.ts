'use server';

import { randomBytes } from 'node:crypto';
import { refresh } from 'next/cache';
import { requireAdmin } from '@/server/auth';
import { BOT_COMMANDS, BOT_DESCRIPTION, BOT_SHORT_DESCRIPTION } from '@/server/botCommands';
import { botSettings, KEYS, type Delivery } from '@/server/botSettings';
import { config } from '@/server/config';
import { runReminderJob } from '@/server/reminders';
import * as repo from '@/server/repo';

/** Admin → Bot. Every action re-checks admin rights and is written to the audit log. */

export interface BotActionState {
  ok: boolean;
  message: string | null;
  error: string | null;
}

const ALLOWED_UPDATES = ['message', 'channel_post', 'edited_channel_post', 'message_reaction_count', 'my_chat_member'];

async function tg<T = unknown>(token: string, method: string, body: object = {}): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    return (await res.json()) as { ok: boolean; result?: T; description?: string };
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : 'Could not reach Telegram' };
  }
}

const log = (admin: repo.UserRecord, action: string, detail?: string) =>
  repo.addAdminLog({ adminId: admin.id, adminName: admin.name, action, targetLabel: 'Telegram bot', detail });

export async function saveBotTokenAction(_prev: BotActionState, fd: FormData): Promise<BotActionState> {
  const admin = await requireAdmin();
  if (botSettings().fromEnv.botToken) return { ok: false, message: null, error: 'The token is set by TELEGRAM_BOT_TOKEN on the server. Remove it there to manage the bot here.' };
  const token = String(fd.get('token') ?? '').trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) return { ok: false, message: null, error: 'That doesn’t look like a bot token. It looks like 123456789:AAH… and comes from @BotFather.' };
  const me = await tg<{ username?: string; first_name: string; is_bot: boolean }>(token, 'getMe');
  if (!me.ok || !me.result?.is_bot) return { ok: false, message: null, error: `Telegram rejected the token${me.description ? `: ${me.description}` : '.'}` };
  repo.setAppSetting(KEYS.token, token);
  repo.setAppSetting(KEYS.username, me.result.username ?? null);
  if (!repo.getAppSetting(KEYS.secret)) repo.setAppSetting(KEYS.secret, randomBytes(24).toString('base64url'));
  // The command menu and the text people see before pressing Start.
  await Promise.all([
    tg(token, 'setMyCommands', { commands: BOT_COMMANDS }),
    tg(token, 'setMyDescription', { description: BOT_DESCRIPTION }),
    tg(token, 'setMyShortDescription', { short_description: BOT_SHORT_DESCRIPTION }),
  ]);
  log(admin, 'Connected bot', `@${me.result.username}`);
  refresh();
  return { ok: true, message: `Connected to @${me.result.username}.`, error: null };
}

export async function removeBotAction() {
  const admin = await requireAdmin();
  const s = botSettings();
  if (s.fromEnv.botToken) return;
  if (s.botToken) await tg(s.botToken, 'deleteWebhook');
  repo.setAppSetting(KEYS.token, null);
  repo.setAppSetting(KEYS.username, null);
  log(admin, 'Removed bot', s.botUsername ? `@${s.botUsername}` : undefined);
  refresh();
}

export async function setDeliveryAction(_prev: BotActionState, fd: FormData): Promise<BotActionState> {
  const admin = await requireAdmin();
  const s = botSettings();
  const delivery: Delivery = fd.get('delivery') === 'webhook' ? 'webhook' : 'polling';
  if (!s.botToken) return { ok: false, message: null, error: 'Connect a bot first.' };

  if (delivery === 'webhook') {
    const base = config.appUrl.replace(/\/$/, '');
    if (!base.startsWith('https://')) return { ok: false, message: null, error: `Webhooks need a public https:// address. APP_URL is ${base}. Use polling, or set APP_URL to your public URL.` };
    let secret = s.webhookSecret;
    if (!secret) {
      secret = randomBytes(24).toString('base64url');
      repo.setAppSetting(KEYS.secret, secret);
    }
    const r = await tg(s.botToken, 'setWebhook', { url: `${base}/api/telegram/webhook`, secret_token: secret, allowed_updates: ALLOWED_UPDATES });
    if (!r.ok) return { ok: false, message: null, error: `Telegram refused the webhook: ${r.description}` };
  } else {
    const r = await tg(s.botToken, 'deleteWebhook');
    if (!r.ok) return { ok: false, message: null, error: `Couldn’t remove the webhook: ${r.description}` };
  }
  repo.setAppSetting(KEYS.delivery, delivery);
  log(admin, 'Changed bot delivery', delivery);
  refresh();
  return { ok: true, message: delivery === 'webhook' ? 'Webhook registered. Telegram will now call this server.' : 'Polling. This server now reads updates from Telegram.', error: null };
}

export async function sendTestAction(): Promise<BotActionState> {
  const admin = await requireAdmin();
  const s = botSettings();
  if (!s.botToken) return { ok: false, message: null, error: 'Connect a bot first.' };
  if (!admin.telegramUserId) return { ok: false, message: null, error: 'Link your own Telegram account first (Channels → Link Telegram), then try again.' };
  const r = await tg(s.botToken, 'sendMessage', { chat_id: Number(admin.telegramUserId), text: '👋 Test from Tally. Bot messages are working.' });
  return r.ok ? { ok: true, message: 'Sent. Check Telegram.', error: null } : { ok: false, message: null, error: `Telegram said: ${r.description}` };
}

export async function runRemindersAction(): Promise<BotActionState> {
  const admin = await requireAdmin();
  const summary = await runReminderJob(new Date());
  repo.setAppSetting(KEYS.lastReminderRun, JSON.stringify({ at: new Date().toISOString(), sent: summary.sent, checked: summary.checked, failed: summary.failed }));
  log(admin, 'Ran reminders', `${summary.sent} sent of ${summary.checked} checked`);
  refresh();
  return { ok: true, message: `Checked ${summary.checked} ${summary.checked === 1 ? 'person' : 'people'}, sent ${summary.sent}${summary.failed ? `, ${summary.failed} failed` : ''}.`, error: null };
}

/** Live status from Telegram for the admin page. */
export async function webhookInfo(): Promise<{ url: string; pending: number; lastError: string | null } | null> {
  await requireAdmin();
  const s = botSettings();
  if (!s.botToken) return null;
  const r = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>(s.botToken, 'getWebhookInfo');
  return r.ok && r.result ? { url: r.result.url, pending: r.result.pending_update_count, lastError: r.result.last_error_message ?? null } : null;
}
