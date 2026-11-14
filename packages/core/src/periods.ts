import { addDays, eachDay, localDate, maxDate, startOfWeek, weekdayOf, type Instant } from './dates';
import type { Cadence, ISODate, Pause, Post, Schedule } from './types';

/**
 * A "period" is one unit of the creator's chosen goal: a day for daily or
 * specific-days cadences, a week for weekly cadences.
 *
 * Statuses are deliberately neutral. `rest` and `paused` periods neither
 * extend nor break a streak, and the period that contains today is
 * `in_progress` until it is either met or over, so a streak never looks
 * broken while the creator still has time.
 */
export type PeriodStatus = 'met' | 'missed' | 'in_progress' | 'paused' | 'rest';

export interface Period {
  unit: 'day' | 'week';
  start: ISODate;
  end: ISODate;
  posted: number;
  target: number;
  status: PeriodStatus;
}

export type CountsByDay = Map<ISODate, number>;

export function countPostsByDay(posts: Pick<Post, 'publishedAt'>[], timeZone: string): CountsByDay {
  const counts: CountsByDay = new Map();
  for (const p of posts) {
    const day = localDate(p.publishedAt, timeZone);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

/** Earliest calendar date we have data for, in the creator's time zone. */
export function earliestPostDate(posts: Pick<Post, 'publishedAt'>[], timeZone: string): ISODate | null {
  let earliest: ISODate | null = null;
  for (const p of posts) {
    const d = localDate(p.publishedAt, timeZone);
    if (earliest === null || d < earliest) earliest = d;
  }
  return earliest;
}

/**
 * The first day tracking applies to: the earlier of the connection date and
 * the oldest recorded (e.g. imported) post. Days before this are "untracked",
 * not "missed" — we never judge time we couldn't see.
 */
export function trackingStartFor(
  connectedAt: Instant | null,
  posts: Pick<Post, 'publishedAt'>[],
  timeZone: string,
  today: ISODate,
): ISODate {
  const candidates: ISODate[] = [];
  if (connectedAt != null) candidates.push(localDate(connectedAt, timeZone));
  const first = earliestPostDate(posts, timeZone);
  if (first) candidates.push(first);
  if (candidates.length === 0) return today;
  return candidates.sort()[0]!;
}

export function isPaused(date: ISODate, pauses: Pause[]): boolean {
  return pauses.some((p) => date >= p.start && date <= p.end);
}

/** Whether the cadence asks for posts on this day (weekly cadences: any day). */
export function isScheduledDay(date: ISODate, cadence: Cadence): boolean {
  return cadence.kind === 'days' ? cadence.days.includes(weekdayOf(date)) : true;
}

export function periodUnit(cadence: Cadence): 'day' | 'week' {
  return cadence.kind === 'weekly' ? 'week' : 'day';
}

/**
 * Evaluate every goal period from `trackingStart` through `today` (inclusive).
 */
export function evaluatePeriods(input: {
  schedule: Schedule;
  counts: CountsByDay;
  trackingStart: ISODate;
  today: ISODate;
}): Period[] {
  const { schedule, counts, trackingStart, today } = input;
  const { cadence, pauses } = schedule;
  if (trackingStart > today) return [];

  if (cadence.kind !== 'weekly') {
    return eachDay(trackingStart, today).map((day): Period => {
      const posted = counts.get(day) ?? 0;
      const target = cadence.postsPerDay;
      let status: PeriodStatus;
      // Posting on a paused day still counts — a bonus, never a penalty.
      if (posted >= target && isScheduledDay(day, cadence)) status = 'met';
      else if (!isScheduledDay(day, cadence)) status = 'rest';
      else if (isPaused(day, pauses)) status = 'paused';
      else if (day === today) status = 'in_progress';
      else status = 'missed';
      return { unit: 'day', start: day, end: day, posted, target, status };
    });
  }

  const periods: Period[] = [];
  for (let weekStart = startOfWeek(trackingStart, schedule.weekStartsOn); weekStart <= today; weekStart = addDays(weekStart, 7)) {
    const weekEnd = addDays(weekStart, 6);
    const days = eachDay(weekStart, weekEnd);
    const posted = days.reduce((n, d) => n + (counts.get(d) ?? 0), 0);
    // Days before tracking began or inside a pause shrink the week's target
    // proportionally, so a half-week break asks for roughly half the posts.
    const activeDays = days.filter((d) => d >= trackingStart && !isPaused(d, pauses)).length;
    const target = activeDays === 0 ? 0 : Math.max(1, Math.ceil((cadence.postsPerWeek * activeDays) / 7));
    let status: PeriodStatus;
    if (target > 0 && posted >= target) status = 'met';
    else if (activeDays === 0) status = posted > 0 ? 'met' : 'paused';
    else if (weekEnd >= today) status = 'in_progress';
    else status = 'missed';
    periods.push({ unit: 'week', start: weekStart, end: weekEnd, posted, target, status });
  }
  return periods;
}

export interface StreakSummary {
  unit: 'day' | 'week';
  current: number;
  best: number;
  /** End date of the period where the best streak was (last) reached. */
  bestEndedOn: ISODate | null;
  /** For each met period, the streak length after it. Used by medal rules. */
  timeline: { end: ISODate; length: number }[];
}

export function computeStreaks(periods: Period[], unit: 'day' | 'week'): StreakSummary {
  let run = 0;
  let best = 0;
  let bestEndedOn: ISODate | null = null;
  const timeline: StreakSummary['timeline'] = [];
  for (const p of periods) {
    if (p.status === 'met') {
      run += 1;
      timeline.push({ end: p.end, length: run });
      if (run >= best) {
        best = run;
        bestEndedOn = p.end;
      }
    } else if (p.status === 'missed') {
      run = 0;
    }
    // rest, paused and in_progress leave the streak untouched.
  }
  return { unit, current: run, best, bestEndedOn, timeline };
}

export type ProgressState = 'met' | 'in_progress' | 'rest' | 'paused';

export interface GoalProgress {
  unit: 'day' | 'week';
  state: ProgressState;
  posted: number;
  target: number;
  remaining: number;
  periodStart: ISODate;
  periodEnd: ISODate;
  /** Days left in the current period, including today. */
  daysLeft: number;
  postedToday: number;
  /** Next day the goal asks for a post, when today is a rest or paused day. */
  nextScheduledDay: ISODate | null;
}

export function currentProgress(input: { schedule: Schedule; counts: CountsByDay; today: ISODate; trackingStart: ISODate }): GoalProgress {
  const { schedule, counts, today } = input;
  const { cadence, pauses } = schedule;
  const postedToday = counts.get(today) ?? 0;
  const trackingStart = input.trackingStart > today ? today : input.trackingStart;

  const nextScheduled = (): ISODate | null => {
    for (let i = 1; i <= 366; i++) {
      const d = addDays(today, i);
      if (isScheduledDay(d, cadence) && !isPaused(d, pauses)) return d;
    }
    return null;
  };

  if (cadence.kind === 'weekly') {
    const periods = evaluatePeriods({ schedule, counts, trackingStart: maxDate(trackingStart, startOfWeek(today, schedule.weekStartsOn)), today });
    const week = periods[periods.length - 1]!;
    const paused = isPaused(today, pauses) && week.status !== 'met';
    return {
      unit: 'week',
      state: week.status === 'met' ? 'met' : paused ? 'paused' : 'in_progress',
      posted: week.posted,
      target: week.target,
      remaining: Math.max(0, week.target - week.posted),
      periodStart: week.start,
      periodEnd: week.end,
      daysLeft: eachDay(today, week.end).length,
      postedToday,
      nextScheduledDay: paused ? nextScheduled() : null,
    };
  }

  const target = cadence.postsPerDay;
  let state: ProgressState;
  if (postedToday >= target && isScheduledDay(today, cadence)) state = 'met';
  else if (!isScheduledDay(today, cadence)) state = 'rest';
  else if (isPaused(today, pauses)) state = 'paused';
  else state = 'in_progress';
  return {
    unit: 'day',
    state,
    posted: postedToday,
    target,
    remaining: state === 'in_progress' ? Math.max(0, target - postedToday) : 0,
    periodStart: today,
    periodEnd: today,
    daysLeft: 1,
    postedToday,
    nextScheduledDay: state === 'rest' || state === 'paused' ? nextScheduled() : null,
  };
}
