import { formatShortDate, localDate } from './dates';
import type { StreakSummary } from './periods';
import type { ISODate, Post } from './types';

/**
 * Medals, in the spirit of GitHub achievements: a medal appears once it is
 * earned, and higher tiers change its metal and add a ×2, ×3, ×4 mark.
 *
 * They are derived purely from recorded data (reaction counts reported by the
 * platform, stars given on Emberly), so the same data always yields the same
 * medals. Every award carries a date and a plain-language reason.
 */

export type ReactionMedalId = 'fire' | 'heart' | 'thumbs-up' | 'laugh' | 'clap' | 'party' | 'star-struck' | 'paid-star';
export type MedalId = 'crowd-pleaser' | 'starstruck' | ReactionMedalId;

export interface MedalDefinition {
  id: MedalId;
  name: string;
  /** One-sentence rule shown on the medal. */
  rule: string;
  /** Thresholds for ×1, ×2, ×3, ×4. */
  tiers: number[];
  /** What appears on the face of the coin. */
  mark: string;
}

/** Single post: one post reaching this many reactions. */
export const CROWD_PLEASER_TIERS = [100, 200, 500, 1000];
/** Total of one reaction type across every post. */
export const REACTION_TOTAL_TIERS = [100, 500, 1000, 5000];
/** Stars given to your channels by other Emberly members. */
export const STARSTRUCK_TIERS = [10, 50, 100, 500];

/** Reaction medals and the reaction labels (as reported by the platform) they count. */
const REACTIONS: { id: ReactionMedalId; name: string; mark: string; labels: string[] }[] = [
  { id: 'fire', name: 'On Fire', mark: '🔥', labels: ['🔥'] },
  { id: 'heart', name: 'Beloved', mark: '❤️', labels: ['❤', '❤️', '😍', '🥰', '❤‍🔥'] },
  { id: 'thumbs-up', name: 'Thumbs Up', mark: '👍', labels: ['👍'] },
  { id: 'laugh', name: 'Comedian', mark: '😂', labels: ['😂', '🤣'] },
  { id: 'clap', name: 'Applause', mark: '👏', labels: ['👏'] },
  { id: 'party', name: 'Party Starter', mark: '🎉', labels: ['🎉'] },
  { id: 'star-struck', name: 'Starry-Eyed', mark: '🤩', labels: ['🤩'] },
  { id: 'paid-star', name: 'Star Power', mark: '⭐', labels: ['⭐ Paid', '⭐'] },
];

export const MEDALS: Record<MedalId, MedalDefinition> = {
  'crowd-pleaser': {
    id: 'crowd-pleaser',
    name: 'Crowd Pleaser',
    rule: 'One post reached 100 reactions. ×2 at 200, ×3 at 500, ×4 at 1,000.',
    tiers: CROWD_PLEASER_TIERS,
    mark: '100',
  },
  starstruck: {
    id: 'starstruck',
    name: 'Starstruck',
    rule: 'Your channels were starred 10 times on Emberly. ×2 at 50, ×3 at 100, ×4 at 500.',
    tiers: STARSTRUCK_TIERS,
    mark: '★',
  },
  ...(Object.fromEntries(
    REACTIONS.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        rule: `${r.mark} reactions add up to 100 across your posts. ×2 at 500, ×3 at 1,000, ×4 at 5,000.`,
        tiers: REACTION_TOTAL_TIERS,
        mark: r.mark,
      },
    ]),
  ) as Record<ReactionMedalId, MedalDefinition>),
};

export interface MedalAward {
  id: MedalId;
  name: string;
  rule: string;
  /** What appears on the coin face (an emoji, a number or a star). */
  mark: string;
  /** 1-based tier reached (×1…×4); 0 when not yet earned. */
  tier: number;
  tierCount: number;
  earned: boolean;
  earnedOn: ISODate | null;
  /** The number the medal counts (best post's reactions, total of that reaction, stars). */
  value: number;
  /** Why it was awarded, in plain language, citing the data. */
  because: string | null;
  /** Progress toward the next tier, when there is one. */
  next: { current: number; target: number; label: string } | null;
  evidence: { postIds?: string[]; dates?: ISODate[] };
}

const fmt = (n: number) => n.toLocaleString('en-US');
const normalize = (label: string) => label.replace(/️/g, '');

function tierOf(value: number, tiers: number[]): number {
  return tiers.filter((t) => value >= t).length;
}

export function evaluateMedals(input: {
  posts: Post[];
  timeZone: string;
  /** When each star on the creator's channels was given (ISO-8601). */
  stars?: string[];
  /** Accepted for compatibility; streaks no longer award medals. */
  streaks?: StreakSummary;
}): MedalAward[] {
  const { timeZone } = input;
  const posts = [...input.posts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const dayOf = (p: Post) => localDate(p.publishedAt, timeZone);
  const awards: MedalAward[] = [];

  const award = (id: MedalId, value: number, extra: Pick<MedalAward, 'earnedOn' | 'because' | 'evidence'>, unit: string): MedalAward => {
    const def = MEDALS[id];
    const tier = tierOf(value, def.tiers);
    const nextTarget = def.tiers[tier];
    // Crowd Pleaser shows the milestone it reached: 100, 200, 500, 1K.
    const reached = def.tiers[tier - 1];
    const mark = id === 'crowd-pleaser' && reached ? (reached >= 1000 ? `${reached / 1000}K` : String(reached)) : def.mark;
    return {
      id,
      name: def.name,
      rule: def.rule,
      mark,
      tier,
      tierCount: def.tiers.length,
      earned: tier > 0,
      value,
      ...(tier > 0 ? extra : { earnedOn: null, because: null, evidence: {} }),
      next: nextTarget ? { current: value, target: nextTarget, label: `${fmt(nextTarget)} ${unit}${tier > 0 ? ` for ×${tier + 1}` : ''}` } : null,
    };
  };

  // Crowd Pleaser: the single post with the most reactions.
  {
    let best: Post | null = null;
    for (const p of posts) {
      const v = p.metrics.reactions?.value;
      if (v !== undefined && (!best || v > best.metrics.reactions!.value)) best = p;
    }
    const value = best?.metrics.reactions?.value ?? 0;
    awards.push(
      award(
        'crowd-pleaser',
        value,
        {
          earnedOn: best ? dayOf(best) : null,
          because: best ? `Your ${formatShortDate(dayOf(best))} post drew ${fmt(value)} reactions.` : null,
          evidence: best ? { postIds: [best.id] } : {},
        },
        'reactions on one post',
      ),
    );
  }

  // Starstruck: stars on the creator's channels.
  {
    const stars = [...(input.stars ?? [])].sort();
    const tier = tierOf(stars.length, STARSTRUCK_TIERS);
    const reachedAt = tier > 0 ? stars[STARSTRUCK_TIERS[tier - 1]! - 1]! : null;
    awards.push(
      award(
        'starstruck',
        stars.length,
        {
          earnedOn: reachedAt ? localDate(reachedAt, timeZone) : null,
          because: reachedAt ? `Your channels have ${fmt(stars.length)} stars from other Emberly members.` : null,
          evidence: reachedAt ? { dates: [localDate(reachedAt, timeZone)] } : {},
        },
        'stars',
      ),
    );
  }

  // One medal per reaction type, counting that reaction across every post.
  for (const r of REACTIONS) {
    const labels = new Set(r.labels.map(normalize));
    let total = 0;
    let crossing: Post | null = null;
    let lastTier = 0;
    for (const p of posts) {
      const n = (p.metrics.reactions?.breakdown ?? []).filter((b) => labels.has(normalize(b.label))).reduce((sum, b) => sum + b.count, 0);
      if (!n) continue;
      total += n;
      const t = tierOf(total, REACTION_TOTAL_TIERS);
      if (t > lastTier) {
        crossing = p;
        lastTier = t;
      }
    }
    awards.push(
      award(
        r.id,
        total,
        {
          earnedOn: crossing ? dayOf(crossing) : null,
          because: crossing ? `${fmt(total)} ${r.mark} reactions across your posts.` : null,
          evidence: crossing ? { postIds: [crossing.id] } : {},
        },
        `${r.mark} reactions`,
      ),
    );
  }

  return awards;
}
