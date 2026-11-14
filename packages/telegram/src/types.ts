/**
 * The subset of Telegram Bot API types this integration reads.
 * Reference: https://core.telegram.org/bots/api (checked against Bot API 10.4).
 */

export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
}

export interface TgMessage {
  message_id: number;
  date: number;
  edit_date?: number;
  chat: TgChat;
  from?: TgUser;
  sender_chat?: TgChat;
  text?: string;
  caption?: string;
  photo?: unknown[];
  video?: unknown;
  animation?: unknown;
  audio?: unknown;
  voice?: unknown;
  video_note?: unknown;
  document?: unknown;
  poll?: { question: string };
  sticker?: unknown;
}

export type TgReactionType =
  | { type: 'emoji'; emoji: string }
  | { type: 'custom_emoji'; custom_emoji_id: string }
  | { type: 'paid' };

export interface TgReactionCount {
  type: TgReactionType;
  total_count: number;
}

export interface TgMessageReactionCountUpdated {
  chat: TgChat;
  message_id: number;
  date: number;
  reactions: TgReactionCount[];
}

export interface TgChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user: TgUser;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
}

export interface TgChatMemberUpdated {
  chat: TgChat;
  from: TgUser;
  date: number;
  old_chat_member: TgChatMember;
  new_chat_member: TgChatMember;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
  message_reaction_count?: TgMessageReactionCountUpdated;
  my_chat_member?: TgChatMemberUpdated;
}

export interface TgChatFullInfo extends TgChat {
  description?: string;
}

/**
 * Update types to request. `message_reaction_count` is excluded by default
 * and must be listed explicitly, per the Bot API docs.
 */
export const ALLOWED_UPDATES = ['message', 'channel_post', 'edited_channel_post', 'message_reaction_count', 'my_chat_member'] as const;
