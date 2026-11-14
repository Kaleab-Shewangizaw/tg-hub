import 'server-only';
import type { PlatformId, PlatformProvider, ProviderCapabilities } from '@emberly/core';
import { createTelegramProvider, TELEGRAM_CAPABILITIES } from '@emberly/telegram';
import { config } from './config';

/**
 * Provider registry. Adding X later means: implement `PlatformProvider` in
 * `packages/x`, register it here, and add a sync job that calls `syncPosts`.
 */

let telegram: ReturnType<typeof createTelegramProvider> | null = null;

/** The live Telegram provider, or null in development mode (no token). */
export function telegramProvider() {
  if (!config.telegram.botToken) return null;
  telegram ??= createTelegramProvider({ token: config.telegram.botToken });
  return telegram;
}

export function providerFor(platform: PlatformId): PlatformProvider | null {
  return platform === 'telegram' ? telegramProvider() : null;
}

export function capabilitiesFor(platform: PlatformId): ProviderCapabilities {
  if (platform === 'telegram') return TELEGRAM_CAPABILITIES;
  throw new Error(`Platform ${platform} is not available yet`);
}

/** The bot's @username: from env, or looked up once via getMe. */
export async function telegramBotUsername(): Promise<string | null> {
  if (config.telegram.botUsername) return config.telegram.botUsername;
  const p = telegramProvider();
  if (!p) return null;
  try {
    return (await p.getMe()).username ?? null;
  } catch {
    return null;
  }
}
