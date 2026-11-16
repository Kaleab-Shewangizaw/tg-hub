import 'server-only';
import type { TgUpdate } from '@emberly/telegram';
import { config } from './config';
import { loadDashboard } from './dashboard';
import * as repo from './repo';

/**
 * Replies to people talking to the bot directly: /start (without a link
 * code), /status, /help, and anything else. Link codes ("/start <token>")
 * are handled by the ingestion pipeline, not here.
 */

/** Shown in Telegram's command menu; set when a bot is connected. */
export const BOT_COMMANDS = [
  { command: 'status', description: 'Your goal, streak and posts this week' },
  { command: 'help', description: 'How Tally works' },
];

export const BOT_DESCRIPTION =
  'Tally tracks your Telegram channel’s posting rhythm: every post on one grid, streaks on your own schedule, a gentle daily reminder and medals when your posts take off.';
export const BOT_SHORT_DESCRIPTION = 'Your channel’s posting rhythm, tracked. Reminders and medals from Tally.';

const LINK_CODE = /^\/start(?:@\w+)?\s+[A-Za-z0-9_-]{1,64}\s*$/;
const app = () => config.appUrl.replace(/\/$/, '');

/** The reply for a private message to the bot, or null if it isn't ours to answer. */
export function botReply(update: TgUpdate): { chatId: number; text: string } | null {
  const m = update.message;
  if (!m || m.chat.type !== 'private' || !m.from || m.from.is_bot || !m.text) return null;
  const text = m.text.trim();
  if (LINK_CODE.test(text)) return null; // account linking: handled by ingestion
  const command = text.startsWith('/') ? text.split(/[\s@]/)[0]!.toLowerCase() : null;
  const user = repo.getUserByTelegramId(String(m.from.id));
  const reply = (body: string) => ({ chatId: m.chat.id, text: body });

  if (command === '/status') {
    if (!user) return reply(notLinked(m.from.first_name));
    return reply(status(user));
  }
  if (command === '/start') {
    if (user) return reply(`Welcome back, ${user.name.split(' ')[0]}. You’re linked to Tally.\n\n${status(user)}`);
    return reply(`Hi ${m.from.first_name} 👋 I’m the Tally bot.\n\n${linkSteps()}`);
  }
  return reply(help(!!user));
}

function notLinked(firstName: string) {
  return `Hi ${firstName}, this Telegram account isn’t linked to Tally yet.\n\n${linkSteps()}`;
}

function linkSteps() {
  return [
    'To get started:',
    `1. Sign in at ${app()}`,
    '2. Go to Channels and press “Link Telegram”',
    '3. Add me to your channel as an admin (no permissions needed)',
    '',
    'Then I’ll track your posts, nudge you once a day if your goal isn’t met, and tell you when you earn a medal.',
  ].join('\n');
}

function help(linked: boolean) {
  return [
    'Here’s what I do:',
    '• Record each post and its reactions in channels you’ve connected',
    '• Send at most one reminder a day, only if your goal isn’t met',
    '• Tell you when you earn a medal',
    '',
    '/status — your goal, streak and posts this week',
    linked ? `\nSettings: ${app()}/app/settings` : `\nNot linked yet? Open ${app()}/app/channels and press “Link Telegram”.`,
  ].join('\n');
}

function status(user: repo.UserRecord): string {
  const channels = repo.listChannels(user.id);
  if (channels.length === 0) return `No channel connected yet. Add me to your channel as an admin, then press Verify in ${app()}/app/channels.`;
  const { dashboard: d } = loadDashboard(user);
  const unit = d.streaks.unit === 'week' ? 'week' : 'day';
  const streak = d.streaks.current > 0 ? `🔥 ${d.streaks.current}-${unit} streak (best ${d.streaks.best})` : `No streak running yet (best ${d.streaks.best})`;
  const p = d.progress;
  const goal = p.state === 'rest' || p.state === 'paused' ? p.headline : `${p.posted} of ${p.target} posts ${p.unit === 'week' ? 'this week' : 'today'}`;
  const medals = d.medals.filter((m) => m.earned).length;
  return [`📊 ${goal}`, streak, `🏅 ${medals} medal${medals === 1 ? '' : 's'}`, '', `${app()}/app`].join('\n');
}
