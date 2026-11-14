import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildActivityGrid,
  buildDashboard,
  computeStreaks,
  countPostsByDay,
  currentProgress,
  decideReminder,
  evaluateMedals,
  evaluatePeriods,
  generateDemoData,
  localDate,
  progressHeadline,
  reminderKey,
  startOfWeek,
  zonedTimeToUtc,
  type Post,
  type ReminderSettings,
  type Schedule,
} from './index';

const post = (publishedAt: string, extra: Partial<Post> = {}): Post => ({
  id: publishedAt,
  channelId: 'c1',
  platform: 'telegram',
  externalId: publishedAt,
  publishedAt,
  kind: 'text',
  textPreview: null,
  url: null,
  source: 'live',
  metrics: {},
  ...extra,
});

const daily = (tz = 'UTC', pauses: Schedule['pauses'] = []): Schedule => ({
  cadence: { kind: 'daily', postsPerDay: 1 },
  timeZone: tz,
  weekStartsOn: 1,
  pauses,
});

describe('time zones', () => {
  it('assigns posts to the creator’s local calendar day', () => {
    // 02:30 UTC on Mar 5 is still Mar 4 in New York.
    expect(localDate('2026-03-05T02:30:00Z', 'America/New_York')).toBe('2026-03-04');
    expect(localDate('2026-03-05T02:30:00Z', 'Asia/Tokyo')).toBe('2026-03-05');
  });

  it('round-trips wall-clock times across DST', () => {
    const utc = zonedTimeToUtc('2026-03-08', 12 * 60, 'America/New_York'); // DST starts that day
    expect(utc.toISOString()).toBe('2026-03-08T16:00:00.000Z');
  });

  it('counts multiple posts on one day', () => {
    const counts = countPostsByDay([post('2026-03-04T10:00:00Z'), post('2026-03-04T18:00:00Z')], 'UTC');
    expect(counts.get('2026-03-04')).toBe(2);
  });

  it('starts weeks on the configured day', () => {
    expect(startOfWeek('2026-03-04', 1)).toBe('2026-03-02'); // Wednesday → Monday
    expect(startOfWeek('2026-03-04', 0)).toBe('2026-03-01'); // → Sunday
  });
});

describe('streaks', () => {
  it('does not break a daily streak while today is still in progress', () => {
    const posts = ['2026-03-01', '2026-03-02', '2026-03-03'].map((d) => post(`${d}T12:00:00Z`));
    const counts = countPostsByDay(posts, 'UTC');
    const periods = evaluatePeriods({ schedule: daily(), counts, trackingStart: '2026-03-01', today: '2026-03-04' });
    expect(periods.at(-1)?.status).toBe('in_progress');
    const s = computeStreaks(periods, 'day');
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it('resets after a missed scheduled day but keeps the best run', () => {
    const posts = ['2026-03-01', '2026-03-02', '2026-03-04'].map((d) => post(`${d}T12:00:00Z`));
    const counts = countPostsByDay(posts, 'UTC');
    const s = computeStreaks(evaluatePeriods({ schedule: daily(), counts, trackingStart: '2026-03-01', today: '2026-03-04' }), 'day');
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });

  it('treats paused days as neutral', () => {
    const posts = ['2026-03-01', '2026-03-05'].map((d) => post(`${d}T12:00:00Z`));
    const schedule = daily('UTC', [{ start: '2026-03-02', end: '2026-03-04' }]);
    const s = computeStreaks(evaluatePeriods({ schedule, counts: countPostsByDay(posts, 'UTC'), trackingStart: '2026-03-01', today: '2026-03-05' }), 'day');
    expect(s.current).toBe(2);
  });

  it('skips rest days for specific-day cadences', () => {
    // Mon/Wed/Fri goal; posts Mon 2, Wed 4, Fri 6 March 2026.
    const schedule: Schedule = { ...daily(), cadence: { kind: 'days', days: [1, 3, 5], postsPerDay: 1 } };
    const posts = ['2026-03-02', '2026-03-04', '2026-03-06'].map((d) => post(`${d}T12:00:00Z`));
    const periods = evaluatePeriods({ schedule, counts: countPostsByDay(posts, 'UTC'), trackingStart: '2026-03-02', today: '2026-03-07' });
    expect(periods.filter((p) => p.status === 'rest')).toHaveLength(3);
    expect(computeStreaks(periods, 'day').current).toBe(3);
  });

  it('evaluates weekly goals and prorates a partial first week', () => {
    const schedule: Schedule = { ...daily(), cadence: { kind: 'weekly', postsPerWeek: 3 } };
    // Tracking starts Thu Mar 5: 4 of 7 days active → target ceil(3*4/7) = 2.
    const posts = ['2026-03-05', '2026-03-06', '2026-03-10', '2026-03-11', '2026-03-12'].map((d) => post(`${d}T12:00:00Z`));
    const periods = evaluatePeriods({ schedule, counts: countPostsByDay(posts, 'UTC'), trackingStart: '2026-03-05', today: '2026-03-13' });
    expect(periods.map((p) => [p.target, p.status])).toEqual([
      [2, 'met'],
      [3, 'met'],
    ]);
  });

  it('describes progress encouragingly', () => {
    const schedule: Schedule = { ...daily(), cadence: { kind: 'weekly', postsPerWeek: 4 } };
    const posts = ['2026-03-02', '2026-03-03', '2026-03-04'].map((d) => post(`${d}T12:00:00Z`));
    const p = currentProgress({ schedule, counts: countPostsByDay(posts, 'UTC'), today: '2026-03-05', trackingStart: '2026-01-01' });
    expect(p.remaining).toBe(1);
    expect(progressHeadline(p)).toBe("You're one post away from your weekly goal.");
  });
});

describe('activity grid', () => {
  it('builds 53 week columns with levels, rest days and accessible labels', () => {
    const schedule: Schedule = { ...daily(), cadence: { kind: 'days', days: [1, 3, 5], postsPerDay: 1 } };
    const counts = countPostsByDay([post('2026-03-04T08:00:00Z'), post('2026-03-04T09:00:00Z'), post('2026-03-04T10:00:00Z')], 'UTC');
    const grid = buildActivityGrid({ counts, schedule, today: '2026-03-05', trackingStart: '2026-01-01' });
    expect(grid.weeks).toHaveLength(53);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    const cells = grid.weeks.flat();
    const wed = cells.find((c) => c.date === '2026-03-04')!;
    expect(wed.level).toBe(3); // 3–4 posts bucket
    expect(wed.label).toBe('Wednesday, March 4, 2026: 3 posts, goal met');
    expect(cells.find((c) => c.date === '2026-03-03')!.state).toBe('rest');
    expect(cells.find((c) => c.date === '2026-03-06')!.state).toBe('future');
    expect(cells.find((c) => c.date === '2025-12-01')!.state).toBe('untracked');
    expect(grid.buckets.map((b) => b.label)).toEqual(['1 post', '2 posts', '3–4 posts', '5+ posts']);
  });
});

describe('medals', () => {
  it('awards medals only from recorded data, with reasons', () => {
    const posts: Post[] = [];
    for (let i = 0; i < 12; i++) {
      const day = addDays('2026-01-01', i);
      posts.push(post(`${day}T12:00:00Z`, { id: `p${i}`, metrics: { reactions: { value: i === 5 ? 40 : 8, observedAt: '2026-02-01T00:00:00Z' } } }));
    }
    posts.push(post('2026-01-25T12:00:00Z', { id: 'back' })); // 12-day gap
    const counts = countPostsByDay(posts, 'UTC');
    const streaks = computeStreaks(evaluatePeriods({ schedule: daily(), counts, trackingStart: '2026-01-01', today: '2026-01-25' }), 'day');
    const byId = Object.fromEntries(evaluateMedals({ posts, timeZone: 'UTC', streaks }).map((m) => [m.id, m]));

    expect(byId['first-spark']!.earnedOn).toBe('2026-01-01');
    expect(byId['body-of-work']!.tier).toBe(1);
    expect(byId['body-of-work']!.earnedOn).toBe('2026-01-10');
    expect(byId['kept-rhythm']!.tier).toBe(2); // best 12 → 3 and 7 tiers
    expect(byId['welcome-back']!.earned).toBe(true);
    expect(byId['crowd-favorite']!.evidence.postIds).toEqual(['p5']);
    expect(byId['crowd-favorite']!.because).toContain('40 reactions');
  });

  it('does not award Crowd Favorite without enough reaction data', () => {
    const posts = [post('2026-01-01T12:00:00Z', { metrics: { reactions: { value: 500, observedAt: 'x' } } })];
    const streaks = computeStreaks([], 'day');
    const cf = evaluateMedals({ posts, timeZone: 'UTC', streaks }).find((m) => m.id === 'crowd-favorite')!;
    expect(cf.earned).toBe(false);
    expect(cf.next).toEqual({ current: 1, target: 10, label: '10 posts with reaction data' });
  });
});

describe('reminders', () => {
  const settings: ReminderSettings = { enabled: true, time: '18:00', days: [0, 1, 2, 3, 4, 5, 6], quietHours: null };
  const base = {
    userId: 'u1',
    schedule: daily('Europe/Berlin'),
    settings,
    counts: new Map<string, number>(),
    trackingStart: '2026-01-01',
    channelTitle: 'Field Notes',
    sentKeys: new Set<string>(),
  };

  it('sends after the reminder time when nothing is posted, in the creator’s time zone', () => {
    // 17:30 UTC = 18:30 Berlin (CET) on Mar 4.
    const d = decideReminder({ ...base, now: '2026-03-04T17:30:00Z' });
    expect(d.send).toBe(true);
    if (d.send) {
      expect(d.key).toBe(reminderKey('u1', '2026-03-04'));
      expect(d.message).toMatch(/gentle nudge/i);
      expect(d.message).not.toMatch(/fail|broke|miss/i);
    }
  });

  it('is idempotent once the key is recorded', () => {
    const d = decideReminder({ ...base, now: '2026-03-04T17:30:00Z', sentKeys: new Set([reminderKey('u1', '2026-03-04')]) });
    expect(d).toMatchObject({ send: false, reason: 'already_sent' });
  });

  it('respects time, quiet hours, days, goals and pauses', () => {
    expect(decideReminder({ ...base, now: '2026-03-04T16:30:00Z' })).toMatchObject({ reason: 'too_early' });
    expect(decideReminder({ ...base, now: '2026-03-04T22:30:00Z' })).toMatchObject({ reason: 'window_passed' });
    expect(
      decideReminder({ ...base, now: '2026-03-04T17:30:00Z', settings: { ...settings, quietHours: { start: '18:00', end: '07:00' } } }),
    ).toMatchObject({ reason: 'quiet_hours' });
    expect(decideReminder({ ...base, now: '2026-03-04T17:30:00Z', settings: { ...settings, days: [1] } })).toMatchObject({ reason: 'not_reminder_day' });
    expect(decideReminder({ ...base, now: '2026-03-04T17:30:00Z', counts: new Map([['2026-03-04', 1]]) })).toMatchObject({ reason: 'goal_met' });
    expect(
      decideReminder({ ...base, now: '2026-03-04T17:30:00Z', schedule: daily('Europe/Berlin', [{ start: '2026-03-01', end: '2026-03-10' }]) }),
    ).toMatchObject({ reason: 'paused' });
    expect(decideReminder({ ...base, now: '2026-03-04T17:30:00Z', settings: { ...settings, enabled: false } })).toMatchObject({ reason: 'disabled' });
  });
});

describe('demo data', () => {
  it('is deterministic, labelled, and shows a week one post from the goal', () => {
    const now = '2026-11-12T15:00:00Z';
    const a = generateDemoData(now, 'UTC');
    const b = generateDemoData(now, 'UTC');
    expect(a.posts.length).toBe(b.posts.length);
    expect(a.posts.every((p) => p.source === 'demo')).toBe(true);
    expect(a.posts.every((p) => p.metrics.views === undefined)).toBe(true);
    const dash = buildDashboard({ posts: a.posts, channels: [a.channel], schedule: a.schedule, now });
    expect(dash.progress.posted).toBe(3);
    expect(dash.progress.remaining).toBe(1);
    expect(dash.medals.find((m) => m.id === 'welcome-back')!.earned).toBe(true);
  });
});
