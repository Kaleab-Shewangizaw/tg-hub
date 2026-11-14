import type { ISODate, Weekday } from './types';

/**
 * Time zone helpers built on Intl only, so the same code runs in Node,
 * browsers and React Native (Hermes ships Intl with time zone support).
 *
 * Instants are always stored as UTC; calendar dates (ISODate) are always
 * derived for a specific IANA time zone.
 */

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export type Instant = Date | string | number;

/** Local calendar date and minutes-since-midnight for an instant in a time zone. */
export function zonedParts(instant: Instant, timeZone: string): { date: ISODate; minutes: number } {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  };
}

export function localDate(instant: Instant, timeZone: string): ISODate {
  return zonedParts(instant, timeZone).date;
}

function toUtcMs(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function fromUtcMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `b` to `a` (a − b). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / DAY_MS);
}

export function weekdayOf(date: ISODate): Weekday {
  return new Date(toUtcMs(date)).getUTCDay() as Weekday;
}

export function startOfWeek(date: ISODate, weekStartsOn: 0 | 1): ISODate {
  const back = (weekdayOf(date) - weekStartsOn + 7) % 7;
  return addDays(date, -back);
}

/** Inclusive list of dates from `start` to `end`. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** The UTC instant at which the wall clock in `timeZone` reads `date` + `minutes`. */
export function zonedTimeToUtc(date: ISODate, minutes: number, timeZone: string): Date {
  const target = toUtcMs(date) + minutes * 60_000;
  let guess = target;
  // Two passes settle DST transitions; the offset changes at most once per day.
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(guess, timeZone);
    const seen = toUtcMs(p.date) + p.minutes * 60_000;
    guess += target - seen;
  }
  return new Date(guess);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHHMM(value: string): boolean {
  return HHMM.test(value);
}

export function parseHHMM(value: string): number {
  const m = HHMM.exec(value);
  if (!m) throw new Error(`Invalid time "${value}", expected HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** True when `minute` falls in [start, end), wrapping past midnight if needed. */
export function isWithinMinuteRange(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** "Tuesday, March 4, 2026" — for accessible labels. */
export function formatLongDate(date: ISODate): string {
  return longDate.format(new Date(toUtcMs(date)));
}

/** "Mar 4" */
export function formatShortDate(date: ISODate): string {
  return shortDate.format(new Date(toUtcMs(date)));
}

export function formatMonth(date: ISODate): string {
  return monthName.format(new Date(toUtcMs(date)));
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
