import { timingSafeEqual } from 'node:crypto';
import type { TgUpdate } from '@emberly/telegram';
import { botSettings } from '@/server/botSettings';
import { handleTelegramUpdate } from '@/server/telegram';

/**
 * Telegram webhook. Telegram signs nothing, so we require the secret token
 * registered with setWebhook, sent back in X-Telegram-Bot-Api-Secret-Token.
 */
function secretMatches(received: string | null): boolean {
  const expected = botSettings().webhookSecret;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const bot = botSettings();
  if (!bot.botToken || !bot.webhookSecret) {
    return Response.json({ error: 'Telegram is not configured on this server.' }, { status: 503 });
  }
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    await handleTelegramUpdate(update, 'live');
  } catch (e) {
    // A 5xx makes Telegram retry; processed update ids make the retry safe.
    console.error('[telegram webhook] failed', e);
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
