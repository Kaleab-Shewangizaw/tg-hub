import { diffDays, formatShortDate, localDate } from './dates';
import type { StreakSummary } from './periods';
import type { ISODate, Post } from './types';

/**
 * Medals are derived purely from recorded data: given the same posts and
 * schedule, the same medals come out. Nothing is stored that could drift.
 * Every award carries the date it was earned and a plain-language reason.
 */

export type MedalId = 'first-spark' | 'body-of-work' | 'kept-rhythm' | 'welcome-back' | 'crowd-favorite';

export interface MedalDefinition {
  id: MedalId;
  name: string;
  /** One-sentence rule shown on the medal card. */
  rule: string;
  tiers: number[];
  /** What the tier numbers count, for progress text ("posts", "days in a row"). */
  unitLabel: (tierValue: number, streakUnit: 'day' | 'week') => string;
}

export const MEDALS: Record<MedalId, MedalDefinition> = {
  'first-spark': {
    id: 'first-spark',
    name: 'First Spark',
    rule: 'Awarded for the first post we recorded on any connected channel.',
    tiers: [1],
    unitLabel: () => 'post',
  },
  'body-of-work': {
    id: 'body-of-work',
    name: 'Body of Work',
    rule: 'Awarded at 10, 50, 100 and 250 recorded posts.',
    tiers: [10, 50, 100, 250],
    unitLabel: (n) => `post${n === 1 ? '' : 's'}`,
  },
  'kept-rhythm': {
    id: 'kept-rhythm',
    name: 'Kept Rhythm',
    rule: 'Meet your posting goal several times in a row. Rest days and breaks never count against you.',
    // Interpreted in the creator's goal unit: days for daily goals, weeks for weekly goals.
    tiers: [3, 7, 30],
    unitLabel: (n, unit) => (unit === 'week' ? `week${n === 1 ? '' : 's'} in a row` : `goal day${n === 1 ? '' : 's'} in a row`),
  },
  'welcome-back': {
    id: 'welcome-back',
    name: 'Welcome Back',
    rule: 'Posting again after 7 or more days away. Breaks are part of the rhythm.',
    tiers: [1],
    unitLabel: () => 'return',
  },
  'crowd-favorite': {
    id: 'crowd-favorite',
    name: 'Crowd Favorite',
    rule: 'A post earned at least twice your typical reactions (and 10 or more), once 10 posts have reaction data.',
    tiers: [1],
    unitLabel: () => 'standout post',
  },
};

/** Weekly cadences use smaller streak tiers so each medal is similarly reachable. */
const WEEKLY_RHYTHM_TIERS = [2, 4, 12];

export interface MedalAward {
  id: MedalId;
  name: string;
  rule: string;
  /** 1-based tier index reached; 0 when not yet earned. */
  tier: number;
  tierCount: number;
  earned: boolean;
  earnedOn: ISODate | null;
  /** Why it was awarded, in plain language, citing the data. */
  because: string | null;
  /** Progress toward the next tier, when there is one. */
  next: { current: number; target: number; label: string } | null;
  evidence: { postIds?: string[]; dates?: ISODate[] };
}

export const WELCOME_BACK_GAP_DAYS = 7;
export const CROWD_FAVORITE_MIN_POSTS = 10;
export const CROWD_FAVORITE_MIN_REACTIONS = 10;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function evaluateMedals(input: { posts: Post[]; timeZone: string; streaks: StreakSummary }): MedalAward[] {
  const { timeZone, streaks } = input;
  const posts = [...input.posts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const dayOf = (p: Post) => localDate(p.publishedAt, timeZone);
  const awards: MedalAward[] = [];

  const base = (id: MedalId, tierCount: number) => ({
    id,
    name: MEDALS[id].name,
    rule: MEDALS[id].rule,
    tierCount,
    evidence: {},
  });

  // First Spark
  const first = posts[0];
  awards.push({
    ...base('first-spark', 1),
    tier: first ? 1 : 0,
    earned: !!first,
    earnedOn: first ? dayOf(first) : null,
    because: first ? `Your first recorded post went out on ${formatShortDate(dayOf(first))}.` : null,
    next: first ? null : { current: 0, target: 1, label: 'Publish your first post' },
    evidence: first ? { postIds: [first.id] } : {},
  });

  // Body of Work
  {
    const tiers = MEDALS['body-of-work'].tiers;
    const reached = tiers.filter((t) => posts.length >= t);
    const top = reached[reached.length - 1];
    const milestonePost = top ? posts[top - 1]! : null;
    const nextTier = tiers[reached.length];
    awards.push({
      ...base('body-of-work', tiers.length),
      tier: reached.length,
      earned: reached.length > 0,
      earnedOn: milestonePost ? dayOf(milestonePost) : null,
      because: milestonePost ? `Post number ${top} went out on ${formatShortDate(dayOf(milestonePost))}.` : null,
      next: nextTier ? { current: posts.length, target: nextTier, label: `${nextTier} posts` } : null,
      evidence: milestonePost ? { postIds: [milestonePost.id] } : {},
    });
  }

  // Kept Rhythm
  {
    const tiers = streaks.unit === 'week' ? WEEKLY_RHYTHM_TIERS : MEDALS['kept-rhythm'].tiers;
    const reached = tiers.filter((t) => streaks.best >= t);
    const top = reached[reached.length - 1];
    const firstReach = top ? streaks.timeline.find((s) => s.length === top) : undefined;
    const nextTier = tiers[reached.length];
    const unitWord = (n: number) => MEDALS['kept-rhythm'].unitLabel(n, streaks.unit);
    awards.push({
      ...base('kept-rhythm', tiers.length),
      tier: reached.length,
      earned: reached.length > 0,
      earnedOn: firstReach?.end ?? null,
      because: top && firstReach ? `You met your goal ${top} ${unitWord(top)}, reaching it on ${formatShortDate(firstReach.end)}.` : null,
      next: nextTier ? { current: streaks.current, target: nextTier, label: `${nextTier} ${unitWord(nextTier)}` } : null,
      evidence: firstReach ? { dates: [firstReach.end] } : {},
    });
  }

  // Welcome Back
  {
    let returns = 0;
    let latest: { from: ISODate; to: ISODate; postId: string } | null = null;
    for (let i = 1; i < posts.length; i++) {
      const prev = dayOf(posts[i - 1]!);
      const cur = dayOf(posts[i]!);
      if (diffDays(cur, prev) > WELCOME_BACK_GAP_DAYS) {
        returns += 1;
        latest = { from: prev, to: cur, postId: posts[i]!.id };
      }
    }
    awards.push({
      ...base('welcome-back', 1),
      tier: returns > 0 ? 1 : 0,
      earned: returns > 0,
      earnedOn: latest?.to ?? null,
      because: latest
        ? `You came back on ${formatShortDate(latest.to)} after ${diffDays(latest.to, latest.from) - 1} days away${returns > 1 ? ` (${returns} returns so far)` : ''}.`
        : null,
      next: null,
      evidence: latest ? { postIds: [latest.postId], dates: [latest.from, latest.to] } : {},
    });
  }

  // Crowd Favorite — only from reaction counts actually reported by the platform.
  {
    const withReactions = posts.filter((p) => p.metrics.reactions !== undefined);
    let winner: Post | null = null;
    let typical = 0;
    if (withReactions.length >= CROWD_FAVORITE_MIN_POSTS) {
      typical = median(withReactions.map((p) => p.metrics.reactions!.value));
      const threshold = Math.max(CROWD_FAVORITE_MIN_REACTIONS, typical * 2);
      for (const p of withReactions) {
        if (p.metrics.reactions!.value >= threshold && (!winner || p.metrics.reactions!.value > winner.metrics.reactions!.value)) winner = p;
      }
    }
    awards.push({
      ...base('crowd-favorite', 1),
      tier: winner ? 1 : 0,
      earned: !!winner,
      earnedOn: winner ? dayOf(winner) : null,
      because: winner
        ? `Your ${formatShortDate(dayOf(winner))} post drew ${winner.metrics.reactions!.value} reactions; your typical post gets ${Math.round(typical)}.`
        : null,
      next:
        withReactions.length < CROWD_FAVORITE_MIN_POSTS
          ? { current: withReactions.length, target: CROWD_FAVORITE_MIN_POSTS, label: `${CROWD_FAVORITE_MIN_POSTS} posts with reaction data` }
          : null,
      evidence: winner ? { postIds: [winner.id] } : {},
    });
  }

  return awards;
}
