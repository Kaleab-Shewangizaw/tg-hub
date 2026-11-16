import 'server-only';
import type { ChannelVerification } from '@emberly/core';
import {
  parseTelegramExport,
  parseUpdate,
  simulateBotAdded,
  simulateChannelPost,
  simulateReactionCount,
  simulatedChannel,
  simulateStartCommand,
  type TgUpdate,
} from '@emberly/telegram';
import { randomToken, sha256 } from './auth';
import { telegramMode } from './botSettings';
import { applyInboundEvents, type IngestResult } from './ingest';
import { checkMedalsSafely } from './notify';
import { botReply } from './botCommands';
import { telegramBotUsername, telegramProvider } from './platforms';
import * as repo from './repo';

/** Telegram-specific application services: linking, verifying, importing, simulating. */

const LINK_TOKEN_MINUTES = 30;

/** Process one webhook update end to end, including replies. Idempotent per update_id. */
export async function handleTelegramUpdate(update: TgUpdate, source: 'live' | 'simulated' = 'live'): Promise<IngestResult | null> {
  if (typeof update?.update_id !== 'number') return null;
  if (source === 'live' && !repo.markUpdateProcessed('telegram', String(update.update_id))) return null;
  const events = parseUpdate(update);
  const result = applyInboundEvents('telegram', events, source);
  const provider = telegramProvider();
  for (const reply of result.replies) {
    if (source === 'live' && provider) await provider.sendReminder!({ recipientExternalUserId: reply.externalUserId, text: reply.text });
  }
  // New posts and reaction counts can earn medals: tell the channel owners.
  const touched = events.flatMap((e) =>
    e.type === 'post_published' || e.type === 'post_edited' ? [e.channel.externalId] : e.type === 'metrics_updated' ? [e.channelExternalId] : [],
  );
  if (touched.length) await checkMedalsSafely(repo.ownersOfChannels('telegram', [...new Set(touched)]));
  // Direct messages to the bot (/start, /status, /help, anything else).
  const answer = botReply(update);
  if (answer && source === 'live' && provider) await provider.sendReminder!({ recipientExternalUserId: String(answer.chatId), text: answer.text });
  return result;
}

export interface LinkStart {
  /** Live mode: the t.me deep link to open. */
  url: string | null;
  /** Development mode: token the simulator can "send". */
  token: string;
  expiresInMinutes: number;
}

export async function startTelegramLink(userId: string): Promise<LinkStart> {
  // Deep-link payloads allow A-Z a-z 0-9 _ - and up to 64 chars (Bot API docs).
  const token = randomToken(24);
  repo.insertLinkToken(sha256(token), userId, 'telegram', new Date(Date.now() + LINK_TOKEN_MINUTES * 60_000));
  const bot = await telegramBotUsername();
  return { url: bot ? `https://t.me/${bot}?start=${token}` : null, token, expiresInMinutes: LINK_TOKEN_MINUTES };
}

export async function verifyTelegramChannel(user: repo.UserRecord, channelRef: string): Promise<ChannelVerification> {
  const provider = telegramProvider();
  if (!provider) {
    return { ok: false, status: 'pending', checks: [{ label: 'A Telegram bot is configured', passed: false, help: 'Development mode: use the simulator below, or add TELEGRAM_BOT_TOKEN to go live.' }] };
  }
  const result = await provider.verifyChannel({ channelRef: channelRef.trim(), ownerExternalUserId: user.telegramUserId });
  if (result.channel && (result.ok || result.status !== 'pending')) {
    const existing = repo.findChannel('telegram', result.channel.externalId);
    if (existing?.userId && existing.userId !== user.id) {
      return { ok: false, status: 'pending', checks: [...result.checks, { label: 'Channel is not connected to another Tally account', passed: false, help: 'Ask the person who connected it to disconnect it first.' }] };
    }
    if (result.ok) {
      repo.upsertChannel({ platform: 'telegram', ...result.channel, status: 'active', statusDetail: null, source: 'live', userId: user.id });
    }
  }
  return result;
}

export function importTelegramExport(user: repo.UserRecord, json: unknown): { channelTitle: string; added: number; updated: number; skipped: number } {
  const parsed = parseTelegramExport(json);
  const existing = repo.findChannel('telegram', parsed.channel.externalId);
  if (existing?.userId && existing.userId !== user.id) throw new Error('This channel is connected to another Tally account.');
  // Anyone can export a public channel's history, so a file proves nothing about
  // ownership. With a live bot, history only goes into a channel this account has
  // already verified (bot added as admin + getChatMember confirms you're an admin).
  if (telegramMode() === 'live' && !(existing?.userId === user.id && existing.source === 'live')) {
    throw new Error(`Connect and verify “${parsed.channel.title}” first (add the bot as an admin, then press Verify). After that, import its history here.`);
  }
  const channel =
    existing && existing.userId === user.id
      ? existing
      : repo.upsertChannel({
          platform: 'telegram',
          ...parsed.channel,
          status: existing?.status ?? 'pending',
          statusDetail: existing?.statusDetail ?? 'History imported. Add the bot as an administrator to keep tracking new posts.',
          source: 'import',
          userId: user.id,
        });
  let added = 0;
  let updated = 0;
  for (const post of parsed.posts) {
    if (repo.upsertPost(channel.id, post, 'import')) added += 1;
    else updated += 1;
  }
  return { channelTitle: channel.title, added, updated, skipped: parsed.skipped };
}

// ─── Development simulator ───────────────────────────────────────────────────
// Every simulated payload is a real-shaped Telegram update run through the
// same parser and ingestion path. Data is stored with source = 'simulated'.

function assertDevelopment() {
  if (telegramMode() !== 'development') throw new Error('The simulator is only available in development mode.');
}

/** A stable fake Telegram user id for this account, used by the simulator. */
function simulatedTelegramUserId(userId: string): number {
  return 900_000_000 + (parseInt(sha256(userId).slice(0, 6), 16) % 99_999_999);
}

export async function simulateLink(user: repo.UserRecord) {
  assertDevelopment();
  const { token } = await startTelegramLink(user.id);
  await handleTelegramUpdate(simulateStartCommand(simulatedTelegramUserId(user.id), token, user.name), 'simulated');
}

export async function simulateAddChannel(user: repo.UserRecord, title: string) {
  assertDevelopment();
  const chat = simulatedChannel(title.trim() || 'My test channel');
  await handleTelegramUpdate(simulateBotAdded(chat, Number(user.telegramUserId ?? simulatedTelegramUserId(user.id))), 'simulated');
}

export async function simulatePost(user: repo.UserRecord, channelId: string, text: string) {
  assertDevelopment();
  const channel = repo.getChannel(channelId);
  if (!channel || channel.userId !== user.id) throw new Error('Channel not found');
  const chat = { id: Number(channel.externalId), type: 'channel' as const, title: channel.title };
  const messageId = repo.maxExternalPostId(channel.id) + 1;
  await handleTelegramUpdate(simulateChannelPost(chat, messageId, text.trim() || 'A simulated post'), 'simulated');
}

export async function simulateReactions(user: repo.UserRecord, channelId: string) {
  assertDevelopment();
  const channel = repo.getChannel(channelId);
  if (!channel || channel.userId !== user.id) throw new Error('Channel not found');
  const messageId = repo.maxExternalPostId(channel.id);
  if (!messageId) return;
  const chat = { id: Number(channel.externalId), type: 'channel' as const, title: channel.title };
  const r = () => Math.floor(Math.random() * 12);
  await handleTelegramUpdate(simulateReactionCount(chat, messageId, { '👍': r() + 1, '🔥': r(), '❤️': r() }), 'simulated');
}
