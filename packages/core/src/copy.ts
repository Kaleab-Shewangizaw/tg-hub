import { formatLongDate, WEEKDAY_NAMES } from './dates';
import type { GoalProgress, StreakSummary } from './periods';
import type { Cadence } from './types';

/**
 * Product copy that depends on data. Tone rules:
 * - Encourage, never scold. No "broke", "failed", "missed your goal".
 * - Rest and breaks are legitimate states, not gaps to apologise for.
 * - Be specific: say how many posts and how much time is left.
 */

const n = (count: number, word: string) => `${count === 1 ? 'one' : count} ${word}${count === 1 ? '' : 's'}`;

export function describeCadence(cadence: Cadence): string {
  switch (cadence.kind) {
    case 'daily':
      return cadence.postsPerDay === 1 ? 'One post a day' : `${cadence.postsPerDay} posts a day`;
    case 'weekly':
      return cadence.postsPerWeek === 1 ? 'One post a week' : `${cadence.postsPerWeek} posts a week`;
    case 'days': {
      const days = [...cadence.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_NAMES[d].slice(0, 3));
      const per = cadence.postsPerDay === 1 ? 'One post' : `${cadence.postsPerDay} posts`;
      return `${per} on ${days.join(', ')}`;
    }
  }
}

export function progressHeadline(p: GoalProgress): string {
  const period = p.unit === 'week' ? 'your weekly' : "today's";
  switch (p.state) {
    case 'met':
      return p.unit === 'week' ? 'Weekly goal reached. Anything more is a bonus.' : "Today's goal is done. Nicely kept.";
    case 'rest':
      return 'Rest day on your schedule. Enjoy it.';
    case 'paused':
      return "You're on a break. Your streak waits for you.";
    case 'in_progress':
      if (p.remaining === 1) return `You're one post away from ${period} goal.`;
      if (p.posted === 0 && p.unit === 'day') return 'A fresh day. One post keeps your rhythm going.';
      return `${n(p.remaining, 'post')} to go for ${period} goal.`.replace(/^one/, 'One');
  }
}

export function progressDetail(p: GoalProgress): string {
  if (p.state === 'rest' || p.state === 'paused') {
    return p.nextScheduledDay ? `Next goal day: ${formatLongDate(p.nextScheduledDay)}.` : 'No goal days coming up.';
  }
  if (p.unit === 'week') {
    const left = p.daysLeft === 1 ? 'Today is the last day of your week.' : `${p.daysLeft} days left this week.`;
    return `${p.posted} of ${p.target} posts this week. ${left}`;
  }
  return `${p.posted} of ${p.target} post${p.target === 1 ? '' : 's'} today.`;
}

export function streakMessage(s: StreakSummary): string {
  const unit = s.unit === 'week' ? 'week' : 'goal day';
  if (s.current === 0 && s.best === 0) return 'Your first streak starts with your next post.';
  if (s.current === 0) return `Every streak starts with one post. Your best run of ${n(s.best, unit)} is still on the board.`;
  if (s.current >= s.best) return `${n(s.current, unit).replace(/^one/, 'One')} in a row: your best run yet.`;
  return `${n(s.current, unit).replace(/^one/, 'One')} in a row. Your best is ${s.best}.`;
}

export function reminderText(input: { channelTitle: string | null; progress: GoalProgress }): string {
  const { progress: p } = input;
  const where = input.channelTitle ? ` on ${input.channelTitle}` : '';
  const closing = 'If today is a rest day, that’s okay too. You can pause reminders anytime in Emberly.';
  if (p.unit === 'week') {
    const left = p.daysLeft === 1 ? 'today' : `in the next ${p.daysLeft} days`;
    return `A gentle nudge: you’re ${n(p.remaining, 'post')} away from your weekly goal${where}, with time ${left}. ${closing}`;
  }
  return `A gentle nudge: nothing posted${where} yet today. One post keeps your rhythm going. ${closing}`;
}
