import 'server-only';
import { countPostsByDay, decideReminder, localDate, trackingStartFor, type ReminderSkipReason } from '@emberly/core';
import { telegramMode } from './config';
import { telegramProvider } from './platforms';
import * as repo from './repo';

/**
 * Reminder job. Safe to run as often as you like (every 15 minutes is
 * plenty) and safe to run concurrently:
 *   1. `decideReminder` (pure) says whether a reminder is due today.
 *   2. `claimReminder` inserts the (user, local date) row under a primary key;
 *      only one run can win the claim.
 *   3. We send, then mark the row sent / retry / failed.
 * A run that crashes mid-send leaves the row in `sending`, which is treated
 * as settled: we prefer a rare missed nudge over a duplicate one.
 */

export interface ReminderRunSummary {
  checked: number;
  sent: number;
  skipped: Partial<Record<ReminderSkipReason | 'not_claimed', number>>;
  failed: number;
  noRecipient: number;
}

export async function runReminderJob(now = new Date(), onlyUserId?: string): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = { checked: 0, sent: 0, skipped: {}, failed: 0, noRecipient: 0 };
  const users = repo.listUsersWithRemindersEnabled().filter((u) => !onlyUserId || u.id === onlyUserId);
  const provider = telegramProvider();
  const skip = (reason: keyof ReminderRunSummary['skipped']) => (summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1);

  for (const user of users) {
    summary.checked += 1;
    const tz = user.settings.timeZone;
    const channels = repo.listChannels(user.id).filter((c) => c.status !== 'disconnected');
    if (channels.length === 0) {
      skip('disabled');
      continue;
    }
    const posts = repo.listPostsForUser(user.id);
    const decision = decideReminder({
      userId: user.id,
      now,
      schedule: user.settings,
      settings: user.settings.reminders,
      counts: countPostsByDay(posts, tz),
      trackingStart: trackingStartFor(channels[0]!.connectedAt, posts, tz, localDate(now, tz)),
      channelTitle: channels.length === 1 ? channels[0]!.title : null,
      sentKeys: repo.settledReminderKeys(user.id),
    });
    if (!decision.send) {
      skip(decision.reason);
      continue;
    }
    if (!repo.claimReminder(decision.key, user.id, decision.localDate, decision.message)) {
      skip('not_claimed');
      continue;
    }

    if (telegramMode() === 'development' || !provider) {
      repo.addDevOutbox(user.id, decision.message);
      repo.finishReminder(decision.key, 'sent');
      summary.sent += 1;
      continue;
    }
    if (!user.telegramUserId) {
      repo.finishReminder(decision.key, 'no_recipient', 'Telegram account not linked');
      summary.noRecipient += 1;
      continue;
    }
    const result = await provider.sendReminder!({ recipientExternalUserId: user.telegramUserId, text: decision.message });
    if (result.ok) {
      repo.finishReminder(decision.key, 'sent');
      summary.sent += 1;
    } else {
      repo.finishReminder(decision.key, result.retryable ? 'retry' : 'failed', result.error ?? null);
      summary.failed += 1;
    }
  }
  return summary;
}
