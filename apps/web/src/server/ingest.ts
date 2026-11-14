import 'server-only';
import type { DataSource, InboundEvent, PlatformId } from '@emberly/core';
import { sha256 } from './auth';
import { transaction } from './db';
import * as repo from './repo';

/**
 * Platform-neutral ingestion: applies normalized events from any provider.
 * Telegram webhooks, the development simulator and (later) X polling all
 * end up here.
 */

export interface IngestResult {
  postsAdded: number;
  postsUpdated: number;
  metricsApplied: number;
  /** Direct messages to send back on the platform (e.g. "account linked"). */
  replies: { externalUserId: string; text: string }[];
  linkedUserIds: string[];
}

export function applyInboundEvents(platform: PlatformId, events: InboundEvent[], source: DataSource): IngestResult {
  const result: IngestResult = { postsAdded: 0, postsUpdated: 0, metricsApplied: 0, replies: [], linkedUserIds: [] };

  transaction(() => {
    for (const e of events) {
      switch (e.type) {
        case 'post_published':
        case 'post_edited': {
          let channel = repo.findChannel(platform, e.channel.externalId);
          if (!channel || channel.status === 'disconnected' || channel.status === 'pending') {
            // Receiving a post proves the integration can see the channel.
            channel = repo.upsertChannel({ platform, ...e.channel, status: 'active', statusDetail: null, source });
          } else {
            repo.touchChannel(channel.id, new Date().toISOString());
          }
          const parked = repo.takeParkedMetrics(platform, e.channel.externalId, e.post.externalId);
          const isNew = repo.upsertPost(channel.id, { ...e.post, metrics: { ...e.post.metrics, ...parked } }, source);
          if (isNew) result.postsAdded += 1;
          else result.postsUpdated += 1;
          break;
        }

        case 'metrics_updated': {
          const channel = repo.findChannel(platform, e.channelExternalId);
          if (channel && repo.mergePostMetrics(channel.id, e.postExternalId, e.metrics)) result.metricsApplied += 1;
          else repo.parkMetrics(platform, e.channelExternalId, e.postExternalId, e.metrics);
          break;
        }

        case 'channel_access_changed': {
          const actor = e.actorExternalUserId ? repo.getUserByTelegramId(e.actorExternalUserId) : null;
          repo.upsertChannel({
            platform,
            ...e.channel,
            status: e.status,
            statusDetail: e.detail,
            source,
            // Only the admin who adds the bot can auto-claim an unowned channel.
            userId: e.status === 'active' && actor ? actor.id : null,
            addedByExternalUser: e.status === 'active' ? e.actorExternalUserId : null,
          });
          break;
        }

        case 'account_link_requested': {
          const userId = repo.consumeLinkToken(sha256(e.linkToken), platform);
          if (!userId) {
            result.replies.push({
              externalUserId: e.externalUserId,
              text: 'That link has expired or was already used. Open Emberly → Channels and tap “Link Telegram” to get a fresh one.',
            });
            break;
          }
          repo.setTelegramAccount(userId, e.externalUserId, e.displayName);
          const claimed = repo.claimChannelsAddedBy(platform, e.externalUserId, userId);
          result.linkedUserIds.push(userId);
          result.replies.push({
            externalUserId: e.externalUserId,
            text:
              'You’re linked to Emberly. 🌱\n\n' +
              (claimed > 0
                ? `We found ${claimed === 1 ? 'a channel' : `${claimed} channels`} you added the bot to, and tracking is on.`
                : 'Next, add this bot to your channel as an administrator. It doesn’t need permission to post, edit or delete anything.') +
              '\n\nGentle reminders, if you turn them on, will arrive in this chat.',
          });
          break;
        }
      }
    }
  });

  return result;
}
