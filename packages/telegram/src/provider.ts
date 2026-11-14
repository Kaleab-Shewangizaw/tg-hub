import type { ChannelVerification, PlatformProvider, ProviderCapabilities } from '@emberly/core';
import { createTelegramClient, TelegramApiError, type TelegramClient } from './client';
import { channelRef, parseUpdate } from './parse';
import type { TgChatFullInfo, TgChatMember, TgUpdate, TgUser } from './types';

/**
 * What the Telegram Bot API can and cannot provide (checked against Bot API
 * 10.4, November 2026). The UI reads this to explain missing metrics instead
 * of showing zeros.
 */
export const TELEGRAM_CAPABILITIES: ProviderCapabilities = {
  historicalSync: false,
  historyImport: true,
  delivery: 'push',
  directReminders: true,
  metrics: {
    reactions: {
      supported: true,
      note: 'Anonymous reaction totals per emoji. Requires the bot to be a channel admin; Telegram may batch updates for a few minutes. Only posts made while the bot is connected receive live counts.',
    },
    views: { supported: false, reason: 'The Telegram Bot API does not expose view counts for channel posts.' },
    forwards: { supported: false, reason: 'The Telegram Bot API does not expose forward counts.' },
    replies: { supported: false, reason: 'Comment counts are not available to bots for channel posts.' },
    likes: { supported: false, reason: 'Telegram uses reactions rather than likes.' },
    reposts: { supported: false, reason: 'The Telegram Bot API does not expose repost counts.' },
  },
};

export interface TelegramProviderOptions {
  token: string;
  client?: TelegramClient;
}

function isManager(m: TgChatMember | null): boolean {
  return m?.status === 'creator' || m?.status === 'administrator';
}

export function createTelegramProvider(opts: TelegramProviderOptions): PlatformProvider & { getMe(): Promise<TgUser>; client: TelegramClient } {
  const client = opts.client ?? createTelegramClient(opts.token);
  let me: Promise<TgUser> | null = null;
  const getMe = () => (me ??= client.call<TgUser>('getMe').catch((e) => ((me = null), Promise.reject(e))));

  const member = async (chatId: string | number, userId: number | string): Promise<TgChatMember | null> => {
    try {
      return await client.call<TgChatMember>('getChatMember', { chat_id: chatId, user_id: Number(userId) });
    } catch (e) {
      if (e instanceof TelegramApiError && e.code === 400) return null;
      throw e;
    }
  };

  return {
    id: 'telegram',
    displayName: 'Telegram',
    capabilities: TELEGRAM_CAPABILITIES,
    client,
    getMe,

    parseInbound(payload: unknown) {
      return parseUpdate(payload as TgUpdate);
    },

    async verifyChannel({ channelRef: ref, ownerExternalUserId }): Promise<ChannelVerification> {
      const checks: ChannelVerification['checks'] = [];
      const chatId = /^-?\d+$/.test(ref) ? Number(ref) : ref.startsWith('@') ? ref : `@${ref}`;

      let chat: TgChatFullInfo;
      try {
        chat = await client.call<TgChatFullInfo>('getChat', { chat_id: chatId });
      } catch (e) {
        if (e instanceof TelegramApiError && !e.retryable) {
          checks.push({
            label: 'Emberly can see the channel',
            passed: false,
            help: 'Check the @username, and make sure the bot has been added to the channel as an administrator. Private channels connect automatically once you add the bot.',
          });
          return { ok: false, status: 'pending', checks };
        }
        throw e;
      }
      if (chat.type !== 'channel') {
        checks.push({ label: 'This is a channel', passed: false, help: 'Emberly tracks Telegram channels. Groups and chats are not supported yet.' });
        return { ok: false, status: 'pending', checks };
      }
      checks.push({ label: 'Emberly can see the channel', passed: true });

      const bot = await getMe();
      const botMember = await member(chat.id, bot.id);
      const botIsAdmin = isManager(botMember);
      checks.push({
        label: 'The bot is a channel administrator',
        passed: botIsAdmin,
        help: botIsAdmin ? undefined : `Add @${bot.username} as an administrator. It needs no posting, editing or deleting rights; admin status is what lets Telegram send it new posts and reaction counts.`,
      });

      let ownerOk = false;
      if (ownerExternalUserId) {
        ownerOk = isManager(await member(chat.id, ownerExternalUserId));
        checks.push({
          label: 'Your linked Telegram account manages this channel',
          passed: ownerOk,
          help: ownerOk ? undefined : 'Only the channel’s owner or administrators can connect it. Link the Telegram account that manages this channel.',
        });
      } else {
        checks.push({ label: 'Your Telegram account is linked', passed: false, help: 'Link your Telegram account first so we can confirm you manage this channel.' });
      }

      const memberCount = await client.call<number>('getChatMemberCount', { chat_id: chat.id }).catch(() => null);
      const ok = botIsAdmin && ownerOk;
      return {
        ok,
        channel: { ...channelRef(chat), memberCount },
        status: ok ? 'active' : botIsAdmin ? 'pending' : 'needs_attention',
        checks,
      };
    },

    async sendReminder({ recipientExternalUserId, text }) {
      try {
        await client.call('sendMessage', { chat_id: Number(recipientExternalUserId), text, link_preview_options: { is_disabled: true } });
        return { ok: true, retryable: false };
      } catch (e) {
        if (e instanceof TelegramApiError) {
          // 403: the creator blocked or never started the bot. Retrying won't help.
          return { ok: false, retryable: e.retryable, error: e.description };
        }
        return { ok: false, retryable: true, error: e instanceof Error ? e.message : 'Unknown error' };
      }
    },
  };
}
