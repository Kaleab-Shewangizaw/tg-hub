import 'server-only';
import { evaluateMedals, type MedalAward } from '@emberly/core';
import { telegramMode } from './botSettings';
import { config } from './config';
import { telegramProvider } from './platforms';
import * as repo from './repo';

/**
 * Bot messages beyond the daily reminder: one message per newly earned medal
 * or tier. Each (user, medal, tier) is claimed in `medal_notices` before
 * sending, so an announcement happens at most once.
 *
 * The first time we look at someone's medals (new account, or history just
 * imported) we record what they already have without messaging, so nobody
 * gets a burst of messages for medals earned in the past.
 */

export function medalMessage(m: MedalAward): string {
  const title = `${m.mark.length <= 2 ? `${m.mark} ` : ''}New medal: ${m.name}${m.tier > 1 ? ` ×${m.tier}` : ''}`;
  return [`🏅 ${title}`, m.because, `\nSee your medals: ${config.appUrl.replace(/\/$/, '')}/app/medals`].filter(Boolean).join('\n');
}

export async function checkMedals(userId: string, opts: { silent?: boolean } = {}): Promise<{ announced: string[] }> {
  const user = repo.getUser(userId);
  if (!user) return { announced: [] };
  const medals = evaluateMedals({ posts: repo.listPostsForUser(userId), timeZone: user.settings.timeZone, stars: repo.starTimesForOwner(userId) }).filter((m) => m.earned);
  const silent = opts.silent || !repo.hasMedalNotices(userId);

  const fresh: MedalAward[] = [];
  for (const m of medals) {
    // Claim every tier up to the current one; only the highest new tier is announced.
    let claimedTop = false;
    for (let t = 1; t <= m.tier; t++) if (repo.claimMedalNotice(userId, m.id, t) && t === m.tier) claimedTop = true;
    if (claimedTop) fresh.push(m);
  }
  // Keep a marker so an account with no medals yet isn't treated as "first look" forever.
  repo.claimMedalNotice(userId, '_seen', 0);

  if (silent || fresh.length === 0 || !user.notifyMedals || !user.telegramUserId || telegramMode() !== 'live') return { announced: [] };
  const provider = telegramProvider();
  if (!provider?.sendReminder) return { announced: [] };
  for (const m of fresh) {
    const r = await provider.sendReminder({ recipientExternalUserId: user.telegramUserId, text: medalMessage(m) });
    if (!r.ok) console.error('[medals] could not message', userId, r.error);
  }
  return { announced: fresh.map((m) => m.id) };
}

/** Never let a notification problem break the update that triggered it. */
export async function checkMedalsSafely(userIds: Iterable<string>) {
  for (const id of new Set(userIds)) {
    try {
      await checkMedals(id);
    } catch (e) {
      console.error('[medals] check failed', id, e);
    }
  }
}
