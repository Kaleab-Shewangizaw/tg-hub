import { reminderText } from './copy';
import { isWithinMinuteRange, parseHHMM, weekdayOf, zonedParts, type Instant } from './dates';
import { currentProgress, type CountsByDay, type GoalProgress } from './periods';
import type { ISODate, ReminderSettings, Schedule } from './types';

/**
 * Pure reminder decision. The caller (a cron job) supplies the current time,
 * settings and post counts; this function decides whether a reminder is due
 * and returns an idempotency key. The job records the key *before* sending,
 * under a unique constraint, so retries and overlapping runs cannot send twice.
 */

/** After the reminder time, how long a late-running job may still send. */
export const REMINDER_LATE_WINDOW_MINUTES = 180;

export type ReminderSkipReason =
  | 'disabled'
  | 'not_reminder_day'
  | 'too_early'
  | 'window_passed'
  | 'quiet_hours'
  | 'goal_met'
  | 'posted_today'
  | 'rest_day'
  | 'paused'
  | 'already_sent';

export type ReminderDecision =
  | { send: false; reason: ReminderSkipReason; localDate: ISODate }
  | { send: true; key: string; localDate: ISODate; message: string; progress: GoalProgress };

export function reminderKey(userId: string, date: ISODate): string {
  return `reminder:${userId}:${date}`;
}

export function decideReminder(input: {
  userId: string;
  now: Instant;
  schedule: Schedule;
  settings: ReminderSettings;
  counts: CountsByDay;
  trackingStart: ISODate;
  channelTitle: string | null;
  /** Keys already recorded for this user (from the reminder log). */
  sentKeys: ReadonlySet<string>;
}): ReminderDecision {
  const { schedule, settings } = input;
  const { date: today, minutes } = zonedParts(input.now, schedule.timeZone);
  const skip = (reason: ReminderSkipReason): ReminderDecision => ({ send: false, reason, localDate: today });

  if (!settings.enabled) return skip('disabled');
  if (!settings.days.includes(weekdayOf(today))) return skip('not_reminder_day');

  const at = parseHHMM(settings.time);
  if (minutes < at) return skip('too_early');
  if (minutes > at + REMINDER_LATE_WINDOW_MINUTES) return skip('window_passed');
  if (settings.quietHours && isWithinMinuteRange(minutes, parseHHMM(settings.quietHours.start), parseHHMM(settings.quietHours.end))) {
    return skip('quiet_hours');
  }

  const progress = currentProgress({ schedule, counts: input.counts, today, trackingStart: input.trackingStart });
  if (progress.state === 'paused') return skip('paused');
  if (progress.state === 'rest') return skip('rest_day');
  if (progress.state === 'met') return skip('goal_met');
  // Weekly goals: one post today is plenty; don't nag mid-week after a post.
  if (progress.unit === 'week' && progress.postedToday > 0) return skip('posted_today');

  const key = reminderKey(input.userId, today);
  if (input.sentKeys.has(key)) return skip('already_sent');

  return { send: true, key, localDate: today, progress, message: reminderText({ channelTitle: input.channelTitle, progress }) };
}
