import { addDays, formatLongDate, formatMonth, startOfWeek } from './dates';
import { isPaused, isScheduledDay, type CountsByDay } from './periods';
import type { ISODate, Schedule } from './types';

/**
 * The activity grid: one column per week, one row per weekday.
 *
 * Intensity uses explicit, legend-friendly count ranges instead of opaque
 * percentiles, so "3–4 posts" means the same thing on every visit.
 */

export type CellState =
  /** After today. Rendered as a blank placeholder. */
  | 'future'
  /** Before tracking started — we have no data, so we don't judge it. */
  | 'untracked'
  | 'paused'
  /** Not a goal day under a specific-days cadence. */
  | 'rest'
  | 'active';

export interface GridCell {
  date: ISODate;
  count: number;
  /** 0 = no posts, 1–4 = intensity bucket. */
  level: 0 | 1 | 2 | 3 | 4;
  state: CellState;
  /** Daily goal for this day was met (always false for weekly cadences). */
  goalMet: boolean;
  isToday: boolean;
  label: string;
}

export interface GridBucket {
  level: 1 | 2 | 3 | 4;
  min: number;
  /** Inclusive upper bound; null for the open-ended top bucket. */
  max: number | null;
  label: string;
}

export interface ActivityGrid {
  /** Each column is a week of 7 cells, starting on the configured weekday. */
  weeks: GridCell[][];
  /** Column index where each month label should appear. */
  months: { column: number; label: string }[];
  buckets: GridBucket[];
  /** Weekday index (0 = Sunday) for each row, top to bottom. */
  rowWeekdays: number[];
  totals: { posts: number; activeDays: number; trackedDays: number };
  range: { start: ISODate; end: ISODate };
}

function makeBuckets(maxCount: number): GridBucket[] {
  const edges: [number, number | null][] =
    maxCount >= 10
      ? [[1, 2], [3, 5], [6, 9], [10, null]]
      : [[1, 1], [2, 2], [3, 4], [5, null]];
  return edges.map(([min, max], i) => ({
    level: (i + 1) as GridBucket['level'],
    min,
    max,
    label: max === null ? `${min}+ posts` : min === max ? `${min} post${min === 1 ? '' : 's'}` : `${min}–${max} posts`,
  }));
}

function levelFor(count: number, buckets: GridBucket[]): GridCell['level'] {
  if (count <= 0) return 0;
  for (const b of buckets) if (b.max === null || count <= b.max) return b.level;
  return 4;
}

function describe(date: ISODate, count: number, state: CellState, goalMet: boolean, isToday: boolean): string {
  const when = `${formatLongDate(date)}${isToday ? ' (today)' : ''}`;
  if (state === 'future') return `${when}: upcoming`;
  if (state === 'untracked') return `${when}: before tracking started`;
  const posts = count === 0 ? 'No posts' : `${count} post${count === 1 ? '' : 's'}`;
  const notes: string[] = [];
  if (goalMet) notes.push('goal met');
  if (state === 'rest') notes.push('rest day');
  if (state === 'paused') notes.push('on a break');
  return `${when}: ${posts}${notes.length ? `, ${notes.join(', ')}` : ''}`;
}

export function buildActivityGrid(input: {
  counts: CountsByDay;
  schedule: Schedule;
  today: ISODate;
  trackingStart: ISODate;
  weeks?: number;
}): ActivityGrid {
  const { counts, schedule, today, trackingStart } = input;
  const weekCount = input.weeks ?? 53;
  const firstWeek = addDays(startOfWeek(today, schedule.weekStartsOn), -(weekCount - 1) * 7);
  const lastDay = addDays(startOfWeek(today, schedule.weekStartsOn), 6);

  let maxCount = 0;
  for (const [d, c] of counts) if (d >= firstWeek && d <= today && c > maxCount) maxCount = c;
  const buckets = makeBuckets(maxCount);

  const weeks: GridCell[][] = [];
  const months: ActivityGrid['months'] = [];
  const totals = { posts: 0, activeDays: 0, trackedDays: 0 };
  let lastMonth = '';

  for (let w = 0; w < weekCount; w++) {
    const column: GridCell[] = [];
    for (let r = 0; r < 7; r++) {
      const date = addDays(firstWeek, w * 7 + r);
      const count = date <= today ? counts.get(date) ?? 0 : 0;
      let state: CellState;
      if (date > today) state = 'future';
      // A post we hold (e.g. imported) is always shown, even before connection.
      else if (date < trackingStart && count === 0) state = 'untracked';
      else if (schedule.cadence.kind === 'days' && !isScheduledDay(date, schedule.cadence)) state = 'rest';
      else if (isPaused(date, schedule.pauses)) state = 'paused';
      else state = 'active';

      const goalMet =
        schedule.cadence.kind !== 'weekly' &&
        state !== 'future' &&
        state !== 'rest' &&
        count >= schedule.cadence.postsPerDay;
      const isToday = date === today;

      if (state !== 'future' && state !== 'untracked') {
        totals.trackedDays += 1;
        totals.posts += count;
        if (count > 0) totals.activeDays += 1;
      }
      column.push({ date, count, level: levelFor(count, buckets), state, goalMet, isToday, label: describe(date, count, state, goalMet, isToday) });
    }
    // Label each month at the first column whose top cell falls in it.
    const month = formatMonth(column[0]!.date);
    if (month !== lastMonth) {
      // Skip a label squeezed into the very first column if the month changes right after.
      const nextMonthSoon = w === 0 && formatMonth(addDays(firstWeek, 7)) !== month;
      if (!nextMonthSoon) months.push({ column: w, label: month });
      lastMonth = month;
    }
    weeks.push(column);
  }

  const rowWeekdays = Array.from({ length: 7 }, (_, i) => (schedule.weekStartsOn + i) % 7);
  return { weeks, months, buckets, rowWeekdays, totals, range: { start: firstWeek, end: lastDay } };
}
