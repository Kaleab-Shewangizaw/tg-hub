import { describeCadence, progressDetail, progressHeadline, streakMessage } from './copy';
import { localDate, zonedParts, type Instant } from './dates';
import { buildActivityGrid, type ActivityGrid } from './grid';
import { evaluateMedals, type MedalAward } from './medals';
import {
  computeStreaks,
  countPostsByDay,
  currentProgress,
  evaluatePeriods,
  periodUnit,
  trackingStartFor,
  type GoalProgress,
  type PeriodStatus,
  type StreakSummary,
} from './periods';
import type { ProviderCapabilities } from './provider';
import type { Channel, ISODate, Post, Schedule } from './types';
import type { SettingsInput } from './validation';

/**
 * Everything the dashboard needs, computed in one place so the web app,
 * the API (for mobile) and demo mode all show identical numbers.
 */
export interface DayPost {
  id: string;
  /** Local time, HH:MM. */
  time: string;
  kind: Post['kind'];
  preview: string | null;
  reactions: number | null;
  url: string | null;
}

export interface DashboardModel {
  today: ISODate;
  trackingStart: ISODate;
  goalLabel: string;
  progress: GoalProgress & { headline: string; detail: string };
  streaks: Omit<StreakSummary, 'timeline'> & { message: string };
  grid: ActivityGrid;
  /** Years with tracked activity, newest first (always includes the current year). */
  years: number[];
  /** Weekly cadences: goal status per week, keyed by week start date. */
  weekGoals: Record<ISODate, { status: PeriodStatus; posted: number; target: number }> | null;
  medals: MedalAward[];
  /** Posts per local day within the grid range, for the day detail panel. */
  dayPosts: Record<ISODate, DayPost[]>;
  recentPosts: Post[];
  totals: { posts: number; postsWithReactions: number; reactions: number };
}

export function buildDashboard(input: {
  posts: Post[];
  channels: Pick<Channel, 'connectedAt'>[];
  schedule: Schedule;
  now: Instant;
  recentLimit?: number;
  /** When each star on the creator's channels was given, for the Starstruck medal. */
  stars?: string[];
  /** Calendar year for the grid; omitted or current year → rolling last 53 weeks. */
  year?: number | null;
}): DashboardModel {
  const { posts, schedule } = input;
  const tz = schedule.timeZone;
  const today = localDate(input.now, tz);
  const connectedAt = input.channels.map((c) => c.connectedAt).sort()[0] ?? null;
  const trackingStart = trackingStartFor(connectedAt, posts, tz, today);
  const counts = countPostsByDay(posts, tz);

  const periods = evaluatePeriods({ schedule, counts, trackingStart, today });
  const streaks = computeStreaks(periods, periodUnit(schedule.cadence));
  const progress = currentProgress({ schedule, counts, today, trackingStart });
  const { timeline: _timeline, ...streakSummary } = streaks;

  const currentYear = Number(today.slice(0, 4));
  let firstYear = Number(trackingStart.slice(0, 4));
  for (const d of counts.keys()) firstYear = Math.min(firstYear, Number(d.slice(0, 4)));
  const years = Array.from({ length: Math.max(1, currentYear - firstYear + 1) }, (_, i) => currentYear - i);
  const year = input.year != null && years.includes(input.year) && input.year !== currentYear ? input.year : null;

  const grid = buildActivityGrid({ counts, schedule, today, trackingStart, year });
  const dayPosts: Record<ISODate, DayPost[]> = {};
  for (const p of posts) {
    const { date, minutes } = zonedParts(p.publishedAt, tz);
    if (date < grid.range.start || date > grid.range.end) continue;
    (dayPosts[date] ??= []).push({
      id: p.id,
      time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      kind: p.kind,
      preview: p.textPreview,
      reactions: p.metrics.reactions?.value ?? null,
      url: p.url,
    });
  }

  const withReactions = posts.filter((p) => p.metrics.reactions);
  return {
    today,
    trackingStart,
    goalLabel: describeCadence(schedule.cadence),
    progress: { ...progress, headline: progressHeadline(progress), detail: progressDetail(progress) },
    streaks: { ...streakSummary, message: streakMessage(streaks) },
    grid,
    years,
    weekGoals:
      schedule.cadence.kind === 'weekly'
        ? Object.fromEntries(periods.map((p) => [p.start, { status: p.status, posted: p.posted, target: p.target }]))
        : null,
    medals: evaluateMedals({ posts, timeZone: tz, stars: input.stars }),
    dayPosts,
    recentPosts: [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, input.recentLimit ?? 12),
    totals: {
      posts: posts.length,
      postsWithReactions: withReactions.length,
      reactions: withReactions.reduce((sum, p) => sum + (p.metrics.reactions?.value ?? 0), 0),
    },
  };
}

/** Response of GET /api/me/dashboard, shared by the web API and the mobile app. */
export interface DashboardResponse {
  user: { name: string; telegramLinked: boolean };
  mode: 'live' | 'development';
  channels: Channel[];
  capabilities: ProviderCapabilities;
  dashboard: DashboardModel;
  settings: SettingsInput;
  hasSimulatedData: boolean;
}
