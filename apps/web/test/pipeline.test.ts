import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { simulateBotAdded, simulateChannelPost, simulateReactionCount, simulateStartCommand, simulatedChannel } from '@emberly/telegram';

// next/headers isn't available outside a request; these tests never touch cookies.
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect'); } }));

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'emberly-test-'));
delete process.env.TELEGRAM_BOT_TOKEN;

let repo: typeof import('@/server/repo');
let tg: typeof import('@/server/telegram');
let reminders: typeof import('@/server/reminders');
let dashboard: typeof import('@/server/dashboard');

beforeAll(async () => {
  repo = await import('@/server/repo');
  tg = await import('@/server/telegram');
  reminders = await import('@/server/reminders');
  dashboard = await import('@/server/dashboard');
});

describe('Telegram pipeline (simulated updates through the real ingestion path)', () => {
  it('links an account, claims a channel, records posts and reactions, and reminds once', async () => {
    const user = repo.createUser({ email: 'a@example.com', name: 'Ada', passwordHash: 'x', settings: repo.defaultSettings('UTC') })!;

    // Bot added before the creator linked: channel is stored unowned.
    const chat = simulatedChannel('Field Notes', -1001111);
    await tg.handleTelegramUpdate(simulateBotAdded(chat, 4242), 'simulated');
    expect(repo.listChannels(user.id)).toHaveLength(0);

    // Linking with the deep-link token claims it.
    const { token } = await tg.startTelegramLink(user.id);
    const linkResult = await tg.handleTelegramUpdate(simulateStartCommand(4242, token, 'Ada'), 'simulated');
    expect(linkResult?.replies[0]?.text).toMatch(/linked/i);
    expect(repo.listChannels(user.id).map((c) => c.status)).toEqual(['active']);

    // Tokens are single-use.
    const reuse = await tg.handleTelegramUpdate(simulateStartCommand(4242, token), 'simulated');
    expect(reuse?.replies[0]?.text).toMatch(/expired|already used/);

    // Reactions that arrive before the post are parked, then applied.
    await tg.handleTelegramUpdate(simulateReactionCount(chat, 1, { '🔥': 3 }), 'simulated');
    await tg.handleTelegramUpdate(simulateChannelPost(chat, 1, 'hello'), 'simulated');
    await tg.handleTelegramUpdate(simulateChannelPost(chat, 2, 'again'), 'simulated');
    await tg.handleTelegramUpdate(simulateReactionCount(chat, 2, { '👍': 2, '❤️': 1 }), 'simulated');

    const posts = repo.listPostsForUser(user.id);
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.metrics.reactions?.value)).toEqual([3, 3]);
    expect(posts.every((p) => p.source === 'simulated')).toBe(true);

    const d = dashboard.loadDashboard(repo.getUser(user.id)!);
    expect(d.dashboard.totals).toMatchObject({ posts: 2, reactions: 6 });
    expect(d.dashboard.medals.find((m) => m.id === 'first-spark')?.earned).toBe(true);
  });

  it('sends a due reminder exactly once, even when the job runs repeatedly', async () => {
    const user = repo.createUser({ email: 'b@example.com', name: 'Bo', passwordHash: 'x', settings: { ...repo.defaultSettings('UTC'), cadence: { kind: 'daily', postsPerDay: 1 }, reminders: { enabled: true, time: '18:00', days: [0, 1, 2, 3, 4, 5, 6], quietHours: null } } })!;
    await tg.handleTelegramUpdate(simulateBotAdded(simulatedChannel('Quiet Channel', -1002222), 77), 'simulated');
    repo.setTelegramAccount(user.id, '77', 'Bo');
    repo.claimChannelsAddedBy('telegram', '77', user.id);

    const now = new Date();
    now.setUTCHours(18, 30, 0, 0);
    const first = await reminders.runReminderJob(now, user.id);
    const second = await reminders.runReminderJob(now, user.id);
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.skipped.already_sent).toBe(1);
    const outbox = repo.listDevOutbox(user.id);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.text).toMatch(/gentle nudge/i);
  });
});
