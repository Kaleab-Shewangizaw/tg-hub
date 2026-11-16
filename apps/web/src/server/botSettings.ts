import 'server-only';
import { config, type IntegrationMode } from './config';
import * as repo from './repo';

/**
 * Telegram bot settings. Environment variables win (so deployments can pin
 * them); otherwise the values saved in Admin → Bot are used. Read on every
 * call, so changes in the admin panel apply without a restart.
 */

export type Delivery = 'polling' | 'webhook';

export interface BotSettings {
  botToken: string | null;
  botUsername: string | null;
  webhookSecret: string | null;
  /** How updates reach us: long-polling from this server, or Telegram calling our webhook. */
  delivery: Delivery;
  /** Which values are pinned by environment variables (read-only in the admin panel). */
  fromEnv: { botToken: boolean; webhookSecret: boolean };
}

export const KEYS = {
  token: 'telegram.botToken',
  username: 'telegram.botUsername',
  secret: 'telegram.webhookSecret',
  delivery: 'telegram.delivery',
  lastPoll: 'runtime.lastPollAt',
  lastPollError: 'runtime.lastPollError',
  lastReminderRun: 'runtime.lastReminderRun',
} as const;

export function botSettings(): BotSettings {
  const botToken = config.telegram.botToken ?? repo.getAppSetting(KEYS.token);
  const fromDbUsername = config.telegram.botToken ? null : repo.getAppSetting(KEYS.username);
  const delivery = repo.getAppSetting(KEYS.delivery);
  return {
    botToken,
    botUsername: config.telegram.botUsername ?? fromDbUsername,
    webhookSecret: config.telegram.webhookSecret ?? repo.getAppSetting(KEYS.secret),
    // Without a public https URL, Telegram can't reach a webhook, so polling is the default.
    delivery: delivery === 'webhook' || delivery === 'polling' ? delivery : config.appUrl.startsWith('https://') && config.telegram.webhookSecret ? 'webhook' : 'polling',
    fromEnv: { botToken: !!config.telegram.botToken, webhookSecret: !!config.telegram.webhookSecret },
  };
}

/**
 * `live`: a bot token is configured; connections and reminders go through
 * Telegram. `development`: no token; the app offers a clearly labelled
 * simulator that feeds fake updates through the same pipeline.
 */
export function telegramMode(): IntegrationMode {
  return botSettings().botToken ? 'live' : 'development';
}
