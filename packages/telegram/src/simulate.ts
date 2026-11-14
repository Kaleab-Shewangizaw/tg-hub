import type { TgChat, TgUpdate } from './types';

/**
 * Builders for realistic Telegram updates, used by development mode (no bot
 * token) and tests. Simulated updates go through the exact same parser and
 * ingestion path as real webhooks; the app labels the resulting data as
 * simulated.
 */

let updateId = Date.now() % 1_000_000_000;
const nextId = () => ++updateId;
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

export function simulatedChannel(title: string, id = -1009000000000 - Math.floor(Math.random() * 1_000_000)): TgChat {
  return { id, type: 'channel', title };
}

export function simulateBotAdded(chat: TgChat, fromUserId: number, at = new Date()): TgUpdate {
  const bot = { id: 1, is_bot: true, first_name: 'Emberly (simulated)' };
  return {
    update_id: nextId(),
    my_chat_member: {
      chat,
      from: { id: fromUserId, is_bot: false, first_name: 'You' },
      date: unix(at),
      old_chat_member: { status: 'left', user: bot },
      new_chat_member: { status: 'administrator', user: bot, can_post_messages: false },
    },
  };
}

export function simulateChannelPost(chat: TgChat, messageId: number, text: string, at = new Date()): TgUpdate {
  return { update_id: nextId(), channel_post: { message_id: messageId, date: unix(at), chat, sender_chat: chat, text } };
}

export function simulateReactionCount(chat: TgChat, messageId: number, counts: Record<string, number>, at = new Date()): TgUpdate {
  return {
    update_id: nextId(),
    message_reaction_count: {
      chat,
      message_id: messageId,
      date: unix(at),
      reactions: Object.entries(counts).map(([emoji, total_count]) => ({ type: { type: 'emoji', emoji }, total_count })),
    },
  };
}

export function simulateStartCommand(userId: number, token: string, firstName = 'You'): TgUpdate {
  return {
    update_id: nextId(),
    message: {
      message_id: nextId(),
      date: unix(new Date()),
      chat: { id: userId, type: 'private', first_name: firstName },
      from: { id: userId, is_bot: false, first_name: firstName },
      text: `/start ${token}`,
    },
  };
}
