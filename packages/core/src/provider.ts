import type { ConnectionStatus, MetricKey, MetricValue, PlatformId, PostKind } from './types';

/**
 * The boundary every platform integration implements. The rest of the
 * product (storage, grid, streaks, medals, reminders) only ever sees the
 * normalized shapes below.
 *
 * Telegram is push-based (webhook updates), X is expected to be pull-based
 * (API polling), so both `parseInbound` and `syncPosts` are optional — a
 * provider implements whichever its platform supports.
 */

export type MetricSupport = { supported: true; note?: string } | { supported: false; reason: string };

export interface ProviderCapabilities {
  /** Can the integration fetch posts published before it was connected? */
  historicalSync: boolean;
  /** Can a creator upload a platform export to backfill history? */
  historyImport: boolean;
  /** How new posts arrive. */
  delivery: 'push' | 'poll';
  /** Whether the platform lets us message the creator directly for reminders. */
  directReminders: boolean;
  metrics: Record<MetricKey, MetricSupport>;
}

export interface NormalizedPost {
  externalId: string;
  publishedAt: string;
  editedAt?: string | null;
  kind: PostKind;
  textPreview: string | null;
  url: string | null;
  metrics?: Partial<Record<MetricKey, MetricValue>>;
}

export interface ChannelRef {
  externalId: string;
  title: string;
  handle: string | null;
}

/** Normalized events produced from a platform's inbound payloads. */
export type InboundEvent =
  | { type: 'post_published'; channel: ChannelRef; post: NormalizedPost }
  | { type: 'post_edited'; channel: ChannelRef; post: NormalizedPost }
  | { type: 'metrics_updated'; channelExternalId: string; postExternalId: string; metrics: Partial<Record<MetricKey, MetricValue>> }
  | {
      type: 'channel_access_changed';
      channel: ChannelRef;
      status: ConnectionStatus;
      detail: string | null;
      /** Platform user who changed the access (e.g. the admin who added the bot). */
      actorExternalUserId: string | null;
    }
  | { type: 'account_link_requested'; externalUserId: string; displayName: string; linkToken: string };

export interface ChannelVerification {
  ok: boolean;
  channel?: ChannelRef & { memberCount: number | null };
  status: ConnectionStatus;
  /** Human-readable checklist shown in the setup flow. */
  checks: { label: string; passed: boolean; help?: string }[];
}

export interface DeliveryResult {
  ok: boolean;
  /** True when retrying could succeed (rate limit, network); false for permanent failures. */
  retryable: boolean;
  error?: string;
}

export interface PlatformProvider {
  id: PlatformId;
  displayName: string;
  capabilities: ProviderCapabilities;

  /**
   * Confirm the integration can see the channel and that `ownerExternalUserId`
   * (the creator's linked platform account) is allowed to manage it.
   */
  verifyChannel(input: { channelRef: string; ownerExternalUserId: string | null }): Promise<ChannelVerification>;

  /** Push platforms: turn a raw inbound payload into normalized events. */
  parseInbound?(payload: unknown): InboundEvent[];

  /** Poll platforms: fetch posts published after `since`. */
  syncPosts?(input: { channelExternalId: string; since: string | null }): Promise<NormalizedPost[]>;

  /** Send a reminder to the creator's linked account on this platform. */
  sendReminder?(input: { recipientExternalUserId: string; text: string }): Promise<DeliveryResult>;
}
