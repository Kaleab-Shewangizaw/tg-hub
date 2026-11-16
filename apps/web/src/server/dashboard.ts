import 'server-only';
import { buildDashboard, type DashboardResponse } from '@emberly/core';
import { telegramMode } from './botSettings';
import { capabilitiesFor } from './platforms';
import * as repo from './repo';

export type DashboardPayload = DashboardResponse;

/** Shared by the web dashboard and the mobile API so both show the same numbers. */
export function loadDashboard(user: repo.UserRecord, now = new Date(), year: number | null = null): DashboardPayload {
  const channels = repo.listChannels(user.id);
  const posts = repo.listPostsForUser(user.id);
  const dashboard = buildDashboard({ posts, channels, schedule: user.settings, now, year, stars: repo.starTimesForOwner(user.id) });
  return {
    user: { name: user.name, telegramLinked: !!user.telegramUserId },
    mode: telegramMode(),
    channels: channels.map(({ userId: _u, addedByExternalUser: _a, ...c }) => c),
    capabilities: capabilitiesFor('telegram'),
    dashboard,
    settings: user.settings,
    hasSimulatedData: channels.some((c) => c.source !== 'live') || posts.some((p) => p.source === 'simulated'),
  };
}
