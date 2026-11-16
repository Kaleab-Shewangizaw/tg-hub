import { describe, expect, it } from 'vitest';
import { createTelegramProvider, parseTelegramExport, parseUpdate, type TgUpdate } from './index';

const chat = { id: -1001234567890, type: 'channel' as const, title: 'Field Notes', username: 'fieldnotes' };

describe('parseUpdate', () => {
  it('normalizes a channel post', () => {
    const [e] = parseUpdate({ update_id: 1, channel_post: { message_id: 42, date: 1772625600, chat, caption: 'Hello   world', photo: [{}] } });
    expect(e).toEqual({
      type: 'post_published',
      channel: { externalId: '-1001234567890', title: 'Field Notes', handle: 'fieldnotes' },
      post: {
        externalId: '42',
        publishedAt: '2026-03-04T12:00:00.000Z',
        editedAt: null,
        kind: 'photo',
        textPreview: 'Hello world',
        url: 'https://t.me/fieldnotes/42',
      },
    });
  });

  it('sums anonymous reaction counts and keeps the breakdown', () => {
    const [e] = parseUpdate({
      update_id: 2,
      message_reaction_count: {
        chat,
        message_id: 42,
        date: 1772625600,
        reactions: [
          { type: { type: 'emoji', emoji: '🔥' }, total_count: 5 },
          { type: { type: 'custom_emoji', custom_emoji_id: 'a' }, total_count: 2 },
          { type: { type: 'custom_emoji', custom_emoji_id: 'b' }, total_count: 1 },
          { type: { type: 'paid' }, total_count: 3 },
        ],
      },
    });
    expect(e).toMatchObject({ type: 'metrics_updated', postExternalId: '42', metrics: { reactions: { value: 11 } } });
    if (e?.type === 'metrics_updated') {
      expect(e.metrics.reactions!.breakdown).toEqual([
        { label: '🔥', count: 5 },
        { label: 'Custom emoji', count: 3 },
        { label: '⭐ Paid', count: 3 },
      ]);
    }
  });

  it('maps bot membership changes to connection status', () => {
    const base = { chat, from: { id: 7, is_bot: false, first_name: 'A' }, date: 1, old_chat_member: { status: 'left' as const, user: { id: 1, is_bot: true, first_name: 'b' } } };
    const added = parseUpdate({ update_id: 3, my_chat_member: { ...base, new_chat_member: { status: 'administrator', user: base.old_chat_member.user } } });
    const removed = parseUpdate({ update_id: 4, my_chat_member: { ...base, new_chat_member: { status: 'kicked', user: base.old_chat_member.user } } });
    expect(added[0]).toMatchObject({ status: 'active', actorExternalUserId: '7' });
    expect(removed[0]).toMatchObject({ status: 'disconnected' });
  });

  it('reads /start deep-link tokens from private chats only', () => {
    const update = (type: 'private' | 'group'): TgUpdate => ({
      update_id: 5,
      message: { message_id: 1, date: 1, chat: { id: 7, type }, from: { id: 7, is_bot: false, first_name: 'Ada' }, text: '/start abc_DEF-123' },
    });
    expect(parseUpdate(update('private'))).toEqual([{ type: 'account_link_requested', externalUserId: '7', displayName: 'Ada', linkToken: 'abc_DEF-123' }]);
    expect(parseUpdate(update('group'))).toEqual([]);
  });

  it('ignores updates from groups', () => {
    expect(parseUpdate({ update_id: 6, channel_post: { message_id: 1, date: 1, chat: { id: 1, type: 'supergroup' }, text: 'x' } })).toEqual([]);
  });
});

describe('parseTelegramExport', () => {
  it('reads the format written by scripts/telegram-history.py', () => {
    const result = parseTelegramExport({
      name: 'Durov',
      type: 'public_channel',
      id: 1006503122,
      messages: [
        { id: 1, type: 'message', date: '2024-01-02T10:00:00', date_unixtime: '1704189600', text: 'Hello', reactions: [{ type: 'emoji', emoji: '👍', count: 5 }, { type: 'custom_emoji', count: 2 }, { type: 'paid', count: 1 }] },
        { id: 2, type: 'message', date: '2024-01-03T10:00:00', date_unixtime: '1704276000', text: '', photo: '(photo)' },
        { id: 3, type: 'message', date: '2024-01-04T10:00:00', date_unixtime: '1704362400', text: 'Vote', poll: { question: 'Which?' } },
      ],
    });
    expect(result.channel.externalId).toBe('-1001006503122');
    expect(result.posts.map((p) => p.kind)).toEqual(['text', 'photo', 'poll']);
    expect(result.posts[0]?.metrics?.reactions?.value).toBe(8);
    expect(result.posts[1]!.metrics).toEqual({});
  });

  it('imports messages, skips service entries, keeps reactions only when present', () => {
    const result = parseTelegramExport({
      name: 'Field Notes',
      type: 'public_channel',
      id: 1234567890,
      messages: [
        { id: 1, type: 'service', date_unixtime: '1772625600', action: 'create_channel' },
        { id: 2, type: 'message', date_unixtime: '1772625600', text: ['Hello ', { type: 'bold', text: 'there' }], reactions: [{ type: 'emoji', count: 4, emoji: '❤️' }] },
        { id: 3, type: 'message', date_unixtime: '1772712000', photo: 'photos/a.jpg', text: '' },
      ],
    });
    expect(result.channel.externalId).toBe('-1001234567890');
    expect(result.skipped).toBe(1);
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]).toMatchObject({ textPreview: 'Hello there', kind: 'text', metrics: { reactions: { value: 4 } } });
    expect(result.posts[1]).toMatchObject({ kind: 'photo', metrics: {} });
  });

  it('rejects non-channel exports', () => {
    expect(() => parseTelegramExport({ type: 'personal_chat', id: 1, messages: [] })).toThrow(/not a channel/);
  });
});

describe('provider.verifyChannel', () => {
  it('checks bot admin status and owner management rights', async () => {
    const calls: string[] = [];
    const provider = createTelegramProvider({
      token: 'x',
      client: {
        async call<T>(method: string, params: Record<string, unknown> = {}) {
          calls.push(method);
          const results: Record<string, unknown> = {
            getChat: { ...chat },
            getMe: { id: 99, is_bot: true, first_name: 'Emberly', username: 'emberly_bot' },
            getChatMemberCount: 1240,
          };
          if (method === 'getChatMember') {
            return { status: params.user_id === 99 ? 'administrator' : 'creator', user: { id: params.user_id } } as T;
          }
          return results[method] as T;
        },
      },
    });
    const v = await provider.verifyChannel({ channelRef: '@fieldnotes', ownerExternalUserId: '7' });
    expect(v.ok).toBe(true);
    expect(v.status).toBe('active');
    expect(v.channel).toMatchObject({ externalId: '-1001234567890', memberCount: 1240 });
    expect(v.checks.every((c) => c.passed)).toBe(true);
  });
});
