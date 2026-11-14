import { addDays, eachDay, localDate, startOfWeek, weekdayOf, zonedTimeToUtc, type Instant } from './dates';
import type { Channel, Pause, Post, PostKind, ReactionCount, ReminderSettings, Schedule } from './types';

/**
 * Deterministic sample data for demo mode. Everything produced here has
 * `source: 'demo'` and the UI labels it as such. It is shaped like real
 * Telegram data (reactions only, no views) so the demo doesn't promise
 * metrics the live integration can't deliver.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREVIEWS = [
  'Morning light over the old harbour, shot on a borrowed lens.',
  'Three small things I changed in my writing routine this month.',
  'Reader question: how do I start a newsletter without an audience?',
  'Sketchbook page 41. Still learning how to draw hands.',
  'A short thread on why slow mornings make better work.',
  'New episode notes are up, with links to everything we mentioned.',
  'Behind the scenes: the desk, the mess, the coffee.',
  'Poll: what should next week’s deep dive be about?',
  'Field recording from the market this afternoon.',
  'The one tool I keep coming back to, and why.',
  'Weekend reading list: six pieces worth your time.',
  'Draft of the zine cover. Thoughts welcome.',
  'Quick tip: batch your captions on Sunday evening.',
  'A small win worth sharing: 1,000 readers this week.',
  'Notes from a long walk without my phone.',
];

const KINDS: PostKind[] = ['text', 'text', 'photo', 'photo', 'video', 'text', 'poll', 'document'];
const EMOJI = ['👍', '❤️', '🔥', '🎉', '👏', '🤩'];

export const DEMO_CHANNEL_ID = 'demo-channel';

export interface DemoData {
  channel: Channel;
  posts: Post[];
  schedule: Schedule;
  reminders: ReminderSettings;
}

export function generateDemoData(now: Instant = new Date(), timeZone = 'UTC'): DemoData {
  const rand = mulberry32(20260314);
  const today = localDate(now, timeZone);
  const nowMs = new Date(now).getTime();
  const start = addDays(today, -300);
  const weekStart = startOfWeek(today, 1);
  const pause: Pause = { start: addDays(today, -70), end: addDays(today, -61), note: 'Family trip' };
  const unannouncedGap = { start: addDays(today, -205), end: addDays(today, -196) };

  const days: { date: string; count: number }[] = [];
  for (const date of eachDay(start, addDays(weekStart, -1))) {
    if (date >= pause.start && date <= pause.end) continue;
    if (date >= unannouncedGap.start && date <= unannouncedGap.end) continue;
    const wd = weekdayOf(date);
    const chance = wd === 0 ? 0.15 : wd === 6 ? 0.3 : 0.62;
    if (rand() > chance) continue;
    const r = rand();
    days.push({ date, count: r < 0.04 ? 3 : r < 0.18 ? 2 : 1 });
  }
  // This week: exactly three posts so far, so the demo shows "one post away".
  const thisWeek = eachDay(weekStart, today);
  for (let i = 0; i < 3; i++) {
    const date = thisWeek[Math.min(thisWeek.length - 1, Math.floor((i * thisWeek.length) / 3))]!;
    const existing = days.find((d) => d.date === date);
    if (existing) existing.count += 1;
    else days.push({ date, count: 1 });
  }

  const posts: Post[] = [];
  let id = 1200;
  for (const { date, count } of days.sort((a, b) => a.date.localeCompare(b.date))) {
    for (let i = 0; i < count; i++) {
      const minutes = 8 * 60 + Math.floor(rand() * 11 * 60) + i * 75;
      let publishedAt = zonedTimeToUtc(date, Math.min(minutes, 23 * 60 + 50), timeZone);
      if (publishedAt.getTime() > nowMs) {
        // Keep today's posts in the past relative to now, still on today's date.
        const earlier = new Date(nowMs - (count - i) * 20 * 60_000);
        publishedAt = localDate(earlier, timeZone) === date ? earlier : zonedTimeToUtc(date, i, timeZone);
      }
      const ageMinutes = (nowMs - publishedAt.getTime()) / 60_000;
      // Reactions are log-normal-ish with an occasional standout post.
      const standout = rand() < 0.03;
      const total = Math.round(Math.exp(2.6 + rand() * 1.1) * (standout ? 3.2 : 1));
      const metrics: Post['metrics'] = {};
      // The newest post hasn't had reaction counts delivered yet — realistic for Telegram.
      if (ageMinutes > 10) {
        const breakdown: ReactionCount[] = [];
        let left = total;
        for (const e of EMOJI) {
          if (left <= 0) break;
          const c = e === EMOJI[EMOJI.length - 1] ? left : Math.max(0, Math.round(left * (0.35 + rand() * 0.3)));
          if (c > 0) breakdown.push({ label: e, count: c });
          left -= c;
        }
        metrics.reactions = { value: total, breakdown, observedAt: new Date(Math.min(nowMs, publishedAt.getTime() + 86_400_000)).toISOString() };
      }
      id += 1;
      posts.push({
        id: `demo-${id}`,
        channelId: DEMO_CHANNEL_ID,
        platform: 'telegram',
        externalId: String(id),
        publishedAt: publishedAt.toISOString(),
        kind: KINDS[Math.floor(rand() * KINDS.length)]!,
        textPreview: PREVIEWS[Math.floor(rand() * PREVIEWS.length)]!,
        url: null,
        source: 'demo',
        metrics,
      });
    }
  }

  return {
    channel: {
      id: DEMO_CHANNEL_ID,
      platform: 'telegram',
      externalId: '-1000000000000',
      title: 'Field Notes (demo)',
      handle: null,
      status: 'active',
      statusDetail: 'Sample channel for exploring Emberly',
      source: 'demo',
      connectedAt: zonedTimeToUtc(start, 9 * 60, timeZone).toISOString(),
      lastEventAt: posts[posts.length - 1]?.publishedAt ?? null,
      memberCount: 1240,
    },
    posts,
    schedule: { cadence: { kind: 'weekly', postsPerWeek: 4 }, timeZone, weekStartsOn: 1, pauses: [pause] },
    reminders: { enabled: true, time: '18:00', days: [1, 2, 3, 4, 5], quietHours: { start: '22:00', end: '08:00' } },
  };
}
