import type { ChannelRef, InboundEvent, MetricValue, NormalizedPost, PostKind, ReactionCount } from '@emberly/core';
import type { TgChat, TgChatMemberUpdated, TgMessage, TgReactionCount, TgUpdate } from './types';

/** Translate raw Telegram updates into platform-neutral events. Pure, no I/O. */

const PREVIEW_LENGTH = 140;

export function channelRef(chat: TgChat): ChannelRef {
  return { externalId: String(chat.id), title: chat.title ?? chat.username ?? 'Untitled channel', handle: chat.username ?? null };
}

export function postKind(m: TgMessage): PostKind {
  if (m.photo) return 'photo';
  if (m.video || m.animation || m.video_note) return 'video';
  if (m.voice) return 'voice';
  if (m.audio) return 'audio';
  if (m.document) return 'document';
  if (m.poll) return 'poll';
  if (m.sticker) return 'sticker';
  if (m.text) return 'text';
  return 'other';
}

export function preview(text: string | undefined | null): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : flat;
}

export function postUrl(chat: TgChat, messageId: number): string | null {
  return chat.username ? `https://t.me/${chat.username}/${messageId}` : null;
}

function normalizePost(m: TgMessage): NormalizedPost {
  return {
    externalId: String(m.message_id),
    publishedAt: new Date(m.date * 1000).toISOString(),
    editedAt: m.edit_date ? new Date(m.edit_date * 1000).toISOString() : null,
    kind: postKind(m),
    textPreview: preview(m.text ?? m.caption ?? m.poll?.question),
    url: postUrl(m.chat, m.message_id),
  };
}

export function reactionLabel(r: TgReactionCount['type']): string {
  switch (r.type) {
    case 'emoji':
      return r.emoji;
    case 'custom_emoji':
      return 'Custom emoji';
    case 'paid':
      return '⭐ Paid';
  }
}

export function reactionsMetric(reactions: { label: string; count: number }[], observedAt: string): MetricValue {
  // Merge entries that share a label (e.g. several different custom emoji).
  const merged = new Map<string, number>();
  for (const r of reactions) merged.set(r.label, (merged.get(r.label) ?? 0) + r.count);
  const breakdown: ReactionCount[] = [...merged].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return { value: breakdown.reduce((n, r) => n + r.count, 0), breakdown, observedAt };
}

function accessEvent(u: TgChatMemberUpdated): InboundEvent {
  const status = u.new_chat_member.status;
  let mapped: 'active' | 'needs_attention' | 'disconnected';
  let detail: string | null = null;
  if (status === 'administrator' || status === 'creator') {
    mapped = 'active';
  } else if (status === 'left' || status === 'kicked') {
    mapped = 'disconnected';
    detail = 'The Emberly bot was removed from this channel. Past activity is kept; new posts are not recorded.';
  } else {
    mapped = 'needs_attention';
    detail = 'The Emberly bot needs to be a channel administrator to receive posts and reaction counts.';
  }
  return {
    type: 'channel_access_changed',
    channel: channelRef(u.chat),
    status: mapped,
    detail,
    actorExternalUserId: String(u.from.id),
  };
}

const START = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{1,64})\s*$/;

export function parseUpdate(update: TgUpdate): InboundEvent[] {
  const events: InboundEvent[] = [];

  if (update.channel_post && update.channel_post.chat.type === 'channel') {
    events.push({ type: 'post_published', channel: channelRef(update.channel_post.chat), post: normalizePost(update.channel_post) });
  }
  if (update.edited_channel_post && update.edited_channel_post.chat.type === 'channel') {
    events.push({ type: 'post_edited', channel: channelRef(update.edited_channel_post.chat), post: normalizePost(update.edited_channel_post) });
  }
  if (update.message_reaction_count && update.message_reaction_count.chat.type === 'channel') {
    const r = update.message_reaction_count;
    events.push({
      type: 'metrics_updated',
      channelExternalId: String(r.chat.id),
      postExternalId: String(r.message_id),
      metrics: {
        reactions: reactionsMetric(
          r.reactions.map((x) => ({ label: reactionLabel(x.type), count: x.total_count })),
          new Date(r.date * 1000).toISOString(),
        ),
      },
    });
  }
  if (update.my_chat_member && update.my_chat_member.chat.type === 'channel') {
    events.push(accessEvent(update.my_chat_member));
  }
  const m = update.message;
  if (m && m.chat.type === 'private' && m.from && m.text) {
    const match = START.exec(m.text.trim());
    if (match) {
      events.push({
        type: 'account_link_requested',
        externalUserId: String(m.from.id),
        displayName: [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || m.from.username || 'Telegram user',
        linkToken: match[1]!,
      });
    }
  }
  return events;
}
