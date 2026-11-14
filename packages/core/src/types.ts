/**
 * Platform-neutral domain types. Nothing in here knows about Telegram or X:
 * platform adapters translate their own payloads into these shapes.
 */

/** A calendar date in the creator's configured time zone, formatted YYYY-MM-DD. */
export type ISODate = string;

/** JavaScript weekday numbering: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PlatformId = 'telegram' | 'x';

/**
 * Where a record came from. The UI always labels anything that is not `live`
 * so creators never confuse sample data with their real numbers.
 */
export type DataSource = 'live' | 'import' | 'simulated' | 'demo';

export type PostKind =
  | 'text'
  | 'photo'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'poll'
  | 'sticker'
  | 'other';

/**
 * Engagement metrics a platform *might* expose. Each provider declares which
 * ones it can actually collect (see `ProviderCapabilities.metrics`); a missing
 * key on a post means "not recorded", never zero.
 */
export type MetricKey = 'reactions' | 'views' | 'forwards' | 'replies' | 'likes' | 'reposts';

export interface ReactionCount {
  /** Emoji character, or a descriptive label such as "custom emoji" or "paid". */
  label: string;
  count: number;
}

export interface MetricValue {
  value: number;
  breakdown?: ReactionCount[];
  /** When this value was last reported by the platform (ISO-8601 UTC). */
  observedAt: string;
}

export interface Post {
  id: string;
  channelId: string;
  platform: PlatformId;
  /** The platform's own identifier (Telegram message_id, X tweet id). */
  externalId: string;
  /** Publish instant, ISO-8601 UTC. Calendar days are derived per time zone. */
  publishedAt: string;
  editedAt?: string | null;
  kind: PostKind;
  textPreview: string | null;
  url: string | null;
  source: DataSource;
  metrics: Partial<Record<MetricKey, MetricValue>>;
}

export type ConnectionStatus =
  /** Waiting for the creator to finish setup (for example, adding the bot). */
  | 'pending'
  /** Receiving updates normally. */
  | 'active'
  /** Connected, but something limits tracking (for example, missing admin rights). */
  | 'needs_attention'
  /** Access was removed; history is kept but nothing new is recorded. */
  | 'disconnected';

export interface Channel {
  id: string;
  platform: PlatformId;
  externalId: string;
  title: string;
  handle: string | null;
  status: ConnectionStatus;
  statusDetail: string | null;
  source: DataSource;
  connectedAt: string;
  lastEventAt: string | null;
  memberCount: number | null;
}

// ─── Goals & schedule ────────────────────────────────────────────────────────

export type Cadence =
  /** Post at least `postsPerDay` every day. */
  | { kind: 'daily'; postsPerDay: number }
  /** Post at least `postsPerDay` on specific weekdays; other days are rest days. */
  | { kind: 'days'; days: Weekday[]; postsPerDay: number }
  /** Post at least `postsPerWeek` any time during the week. */
  | { kind: 'weekly'; postsPerWeek: number };

/** A planned break. Paused days never count against a streak. */
export interface Pause {
  start: ISODate;
  end: ISODate;
  note?: string | null;
}

export interface Schedule {
  cadence: Cadence;
  timeZone: string;
  /** 1 = weeks start on Monday, 0 = Sunday. */
  weekStartsOn: 0 | 1;
  pauses: Pause[];
}

export interface QuietHours {
  /** "HH:MM", local time. May wrap past midnight (e.g. 22:00–07:00). */
  start: string;
  end: string;
}

export interface ReminderSettings {
  enabled: boolean;
  /** "HH:MM", local time; the earliest moment a reminder may be sent. */
  time: string;
  /** Days on which reminders may be sent. */
  days: Weekday[];
  quietHours: QuietHours | null;
}
