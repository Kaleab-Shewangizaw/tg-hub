import 'server-only';
import { buildActivityGrid, buildDashboard, countPostsByDay, localDate, type ActivityGrid, type DashboardModel, type ProviderCapabilities } from '@emberly/core';
import { capabilitiesFor } from './platforms';
import * as repo from './repo';

/**
 * Public profile data. Only fields meant for other people leave this module:
 * never email, settings, Telegram ids or simulator internals.
 */

export interface PublicChannel {
  id: string;
  title: string;
  handle: string | null;
  memberCount: number | null;
  stars: number;
  starredByViewer: boolean;
  posts: number;
  /** Earliest post we hold for this channel (imported history counts), else when it was connected. */
  since: string;
  lastPostAt: string | null;
}

export interface PublicProfile {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  joinedAt: string;
  /** When their oldest channel started posting, as far as we know. Null without channels. */
  creatorSince: string | null;
  isPublic: boolean;
  isOwner: boolean;
  viewerFollows: boolean;
  followers: number;
  following: number;
  stars: number;
  channels: PublicChannel[];
  dashboard: DashboardModel;
  capabilities: ProviderCapabilities;
}

/** Null when the handle doesn't exist, or the profile is private and the viewer isn't its owner. */
export function loadPublicProfile(handle: string, viewer: repo.UserRecord | null, now = new Date(), year: number | null = null): PublicProfile | null {
  const owner = repo.getUserByHandle(handle);
  if (!owner) return null;
  const isOwner = viewer?.id === owner.id;
  if ((!owner.profilePublic || owner.suspendedAt) && !isOwner) return null;

  const channels = repo.listChannels(owner.id);
  const posts = repo.listPostsForUser(owner.id);
  const dashboard = buildDashboard({ posts, channels, schedule: owner.settings, now, year, stars: repo.starTimesForOwner(owner.id) });
  const { counts, mine } = repo.channelStars(
    channels.map((c) => c.id),
    viewer?.id ?? null,
  );
  const { followers, following } = repo.followCounts(owner.id);
  const stats = repo.channelPostStats(channels.map((c) => c.id));
  const publicChannels = channels.map((c) => {
    const st = stats.get(c.id);
    const since = [st?.firstPostAt, c.connectedAt].filter((x): x is string => !!x).sort()[0]!;
    return {
      id: c.id,
      title: c.title,
      handle: c.handle,
      memberCount: c.memberCount,
      stars: counts.get(c.id) ?? 0,
      starredByViewer: mine.has(c.id),
      posts: st?.posts ?? 0,
      since,
      lastPostAt: st?.lastPostAt ?? null,
    };
  });

  return {
    id: owner.id,
    name: owner.name,
    handle: owner.handle,
    bio: owner.bio,
    joinedAt: owner.createdAt,
    creatorSince: publicChannels.map((c) => c.since).sort()[0] ?? null,
    isPublic: owner.profilePublic,
    isOwner,
    viewerFollows: viewer && !isOwner ? repo.isFollowing(viewer.id, owner.id) : false,
    followers,
    following,
    stars: [...counts.values()].reduce((a, b) => a + b, 0),
    channels: publicChannels,
    dashboard,
    capabilities: capabilitiesFor('telegram'),
  };
}

export interface ExploreCard extends repo.ProfileSummary {
  streak: { current: number; unit: 'day' | 'week' };
  grid: DashboardModel['grid'];
  viewerFollows: boolean;
  isViewer: boolean;
}

/** Creators to discover, each with a small activity preview. */
export function loadExplore(viewer: repo.UserRecord | null, now = new Date()): ExploreCard[] {
  const people = repo.listPublicProfiles(24);
  const followed = viewer ? repo.followedAmong(viewer.id, people.map((p) => p.id)) : new Set<string>();
  return people.flatMap((p) => {
    const owner = repo.getUser(p.id);
    if (!owner) return [];
    const d = buildDashboard({ posts: repo.listPostsForUser(p.id), channels: repo.listChannels(p.id), schedule: owner.settings, now });
    return [{ ...p, streak: { current: d.streaks.current, unit: d.streaks.unit }, grid: d.grid, viewerFollows: followed.has(p.id), isViewer: viewer?.id === p.id }];
  });
}

export interface CreatorChannels {
  profile: PublicProfile;
  channels: (PublicChannel & { grid: ActivityGrid })[];
}

/** A creator's channels, each with its own activity grid. Same visibility rules as the profile. */
export function loadCreatorChannels(handle: string, viewer: repo.UserRecord | null, now = new Date()): CreatorChannels | null {
  const profile = loadPublicProfile(handle, viewer, now);
  if (!profile) return null;
  const owner = repo.getUser(profile.id)!;
  const tz = owner.settings.timeZone;
  const today = localDate(now, tz);
  const byChannel = new Map<string, ReturnType<typeof repo.listPostsForUser>>();
  for (const post of repo.listPostsForUser(owner.id)) {
    const list = byChannel.get(post.channelId) ?? [];
    list.push(post);
    byChannel.set(post.channelId, list);
  }
  return {
    profile,
    channels: profile.channels.map((c) => ({
      ...c,
      grid: buildActivityGrid({ counts: countPostsByDay(byChannel.get(c.id) ?? [], tz), schedule: owner.settings, today, trackingStart: localDate(c.since, tz) }),
    })),
  };
}
