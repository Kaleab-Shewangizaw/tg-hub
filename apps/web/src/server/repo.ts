import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Channel, ConnectionStatus, DataSource, MetricKey, MetricValue, NormalizedPost, PlatformId, Post, SettingsInput } from '@emberly/core';
import { getDb } from './db';

/** The only module that talks SQL. Swap this out to change databases. */

export type UserSettings = SettingsInput;

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  settings: UserSettings;
  telegramUserId: string | null;
  telegramName: string | null;
  createdAt: string;
}

type Row = Record<string, unknown>;
const nowIso = () => new Date().toISOString();
const str = (v: unknown) => (v == null ? null : String(v));

export function defaultSettings(timeZone: string): UserSettings {
  return {
    cadence: { kind: 'weekly', postsPerWeek: 3 },
    timeZone,
    weekStartsOn: 1,
    pauses: [],
    reminders: { enabled: false, time: '18:00', days: [1, 2, 3, 4, 5], quietHours: { start: '22:00', end: '08:00' } },
  };
}

// ─── Users & sessions ────────────────────────────────────────────────────────

function toUser(r: Row): UserRecord {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    settings: JSON.parse(String(r.settings_json)) as UserSettings,
    telegramUserId: str(r.telegram_user_id),
    telegramName: str(r.telegram_name),
    createdAt: String(r.created_at),
  };
}

export function createUser(input: { email: string; name: string; passwordHash: string; settings: UserSettings }): UserRecord | null {
  const id = randomUUID();
  try {
    getDb()
      .prepare('INSERT INTO users (id, email, name, password_hash, settings_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.email.trim(), input.name.trim(), input.passwordHash, JSON.stringify(input.settings), nowIso());
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) return null;
    throw e;
  }
  return getUser(id);
}

export function getUser(id: string): UserRecord | null {
  const r = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
  return r ? toUser(r) : null;
}

export function getUserCredentials(email: string): { id: string; passwordHash: string } | null {
  const r = getDb().prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email.trim()) as Row | undefined;
  return r ? { id: String(r.id), passwordHash: String(r.password_hash) } : null;
}

export function getUserByTelegramId(telegramUserId: string): UserRecord | null {
  const r = getDb().prepare('SELECT * FROM users WHERE telegram_user_id = ?').get(telegramUserId) as Row | undefined;
  return r ? toUser(r) : null;
}

export function listUsersWithRemindersEnabled(): UserRecord[] {
  return (getDb().prepare("SELECT * FROM users WHERE json_extract(settings_json, '$.reminders.enabled') = 1").all() as Row[]).map(toUser);
}

export function saveSettings(userId: string, settings: UserSettings) {
  getDb().prepare('UPDATE users SET settings_json = ? WHERE id = ?').run(JSON.stringify(settings), userId);
}

export function setTelegramAccount(userId: string, telegramUserId: string | null, telegramName: string | null) {
  const db = getDb();
  // A Telegram account can be linked to one Emberly account at a time.
  if (telegramUserId) db.prepare('UPDATE users SET telegram_user_id = NULL, telegram_name = NULL WHERE telegram_user_id = ? AND id != ?').run(telegramUserId, userId);
  db.prepare('UPDATE users SET telegram_user_id = ?, telegram_name = ? WHERE id = ?').run(telegramUserId, telegramName, userId);
}

export function insertSession(tokenHash: string, userId: string, kind: 'web' | 'mobile', expiresAt: Date) {
  getDb().prepare('INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(tokenHash, userId, kind, nowIso(), expiresAt.toISOString());
}

export function findSessionUser(tokenHash: string): UserRecord | null {
  const r = getDb()
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .get(tokenHash, nowIso()) as Row | undefined;
  return r ? toUser(r) : null;
}

export function deleteSession(tokenHash: string) {
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

// ─── Account link tokens (Telegram deep links) ───────────────────────────────

export function insertLinkToken(tokenHash: string, userId: string, platform: PlatformId, expiresAt: Date) {
  const db = getDb();
  db.prepare('DELETE FROM link_tokens WHERE user_id = ? AND platform = ? AND used_at IS NULL').run(userId, platform);
  db.prepare('INSERT INTO link_tokens (token_hash, user_id, platform, expires_at) VALUES (?, ?, ?, ?)').run(tokenHash, userId, platform, expiresAt.toISOString());
}

/** Atomically consume a token; returns the user id if it was valid. */
export function consumeLinkToken(tokenHash: string, platform: PlatformId): string | null {
  const r = getDb()
    .prepare('UPDATE link_tokens SET used_at = ? WHERE token_hash = ? AND platform = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id')
    .get(nowIso(), tokenHash, platform, nowIso()) as Row | undefined;
  return r ? String(r.user_id) : null;
}

// ─── Channels ────────────────────────────────────────────────────────────────

export interface ChannelRecord extends Channel {
  userId: string | null;
  addedByExternalUser: string | null;
}

function toChannel(r: Row): ChannelRecord {
  return {
    id: String(r.id),
    userId: str(r.user_id),
    platform: r.platform as PlatformId,
    externalId: String(r.external_id),
    title: String(r.title),
    handle: str(r.handle),
    status: r.status as ConnectionStatus,
    statusDetail: str(r.status_detail),
    source: r.source as DataSource,
    addedByExternalUser: str(r.added_by_external_user),
    connectedAt: String(r.connected_at),
    lastEventAt: str(r.last_event_at),
    memberCount: r.member_count == null ? null : Number(r.member_count),
  };
}

export function listChannels(userId: string): ChannelRecord[] {
  return (getDb().prepare('SELECT * FROM channels WHERE user_id = ? ORDER BY connected_at').all(userId) as Row[]).map(toChannel);
}

export function getChannel(id: string): ChannelRecord | null {
  const r = getDb().prepare('SELECT * FROM channels WHERE id = ?').get(id) as Row | undefined;
  return r ? toChannel(r) : null;
}

export function findChannel(platform: PlatformId, externalId: string): ChannelRecord | null {
  const r = getDb().prepare('SELECT * FROM channels WHERE platform = ? AND external_id = ?').get(platform, externalId) as Row | undefined;
  return r ? toChannel(r) : null;
}

export function upsertChannel(input: {
  platform: PlatformId;
  externalId: string;
  title: string;
  handle: string | null;
  status: ConnectionStatus;
  statusDetail: string | null;
  source: DataSource;
  userId?: string | null;
  addedByExternalUser?: string | null;
  memberCount?: number | null;
  at?: string;
}): ChannelRecord {
  const existing = findChannel(input.platform, input.externalId);
  const at = input.at ?? nowIso();
  const db = getDb();
  if (existing) {
    db.prepare(
      `UPDATE channels SET title = ?, handle = ?, status = ?, status_detail = ?,
         user_id = COALESCE(user_id, ?),
         added_by_external_user = COALESCE(?, added_by_external_user),
         member_count = COALESCE(?, member_count),
         source = CASE WHEN ? = 'live' THEN 'live' ELSE source END,
         last_event_at = ?
       WHERE id = ?`,
    ).run(input.title, input.handle, input.status, input.statusDetail, input.userId ?? null, input.addedByExternalUser ?? null, input.memberCount ?? null, input.source, at, existing.id);
    return getChannel(existing.id)!;
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO channels (id, user_id, platform, external_id, title, handle, status, status_detail, source, added_by_external_user, connected_at, last_event_at, member_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.userId ?? null, input.platform, input.externalId, input.title, input.handle, input.status, input.statusDetail, input.source, input.addedByExternalUser ?? null, at, at, input.memberCount ?? null);
  return getChannel(id)!;
}

export function touchChannel(id: string, at: string) {
  getDb().prepare('UPDATE channels SET last_event_at = ? WHERE id = ?').run(at, id);
}

/** Claim unowned channels that this platform user added the bot to. */
export function claimChannelsAddedBy(platform: PlatformId, externalUserId: string, userId: string): number {
  const r = getDb()
    .prepare('UPDATE channels SET user_id = ? WHERE platform = ? AND added_by_external_user = ? AND user_id IS NULL')
    .run(userId, platform, externalUserId);
  return Number(r.changes);
}

export function setChannelStatus(id: string, status: ConnectionStatus, detail: string | null) {
  getDb().prepare('UPDATE channels SET status = ?, status_detail = ? WHERE id = ?').run(status, detail, id);
}

export function deleteChannel(id: string) {
  getDb().prepare('DELETE FROM channels WHERE id = ?').run(id);
}

// ─── Posts ───────────────────────────────────────────────────────────────────

function toPost(r: Row): Post {
  return {
    id: String(r.id),
    channelId: String(r.channel_id),
    platform: r.platform as PlatformId,
    externalId: String(r.external_id),
    publishedAt: String(r.published_at),
    editedAt: str(r.edited_at),
    kind: r.kind as Post['kind'],
    textPreview: str(r.text_preview),
    url: str(r.url),
    source: r.source as DataSource,
    metrics: JSON.parse(String(r.metrics_json)) as Post['metrics'],
  };
}

export function listPostsForUser(userId: string): Post[] {
  return (
    getDb()
      .prepare(
        `SELECT p.*, c.platform FROM posts p JOIN channels c ON c.id = p.channel_id
         WHERE c.user_id = ? ORDER BY p.published_at`,
      )
      .all(userId) as Row[]
  ).map(toPost);
}

/** Insert or update a post. Returns true when it was new. */
export function upsertPost(channelId: string, post: NormalizedPost, source: DataSource): boolean {
  const db = getDb();
  const existing = db.prepare('SELECT id, metrics_json FROM posts WHERE channel_id = ? AND external_id = ?').get(channelId, post.externalId) as Row | undefined;
  if (existing) {
    const metrics = { ...(JSON.parse(String(existing.metrics_json)) as object), ...(post.metrics ?? {}) };
    db.prepare('UPDATE posts SET edited_at = COALESCE(?, edited_at), kind = ?, text_preview = ?, url = COALESCE(?, url), metrics_json = ? WHERE id = ?').run(
      post.editedAt ?? null,
      post.kind,
      post.textPreview,
      post.url,
      JSON.stringify(metrics),
      String(existing.id),
    );
    return false;
  }
  db.prepare(
    `INSERT INTO posts (id, channel_id, external_id, published_at, edited_at, kind, text_preview, url, source, metrics_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), channelId, post.externalId, post.publishedAt, post.editedAt ?? null, post.kind, post.textPreview, post.url, source, JSON.stringify(post.metrics ?? {}));
  return true;
}

/** Merge metric values into a stored post. Returns false if the post is unknown. */
export function mergePostMetrics(channelId: string, externalId: string, metrics: Partial<Record<MetricKey, MetricValue>>): boolean {
  const db = getDb();
  const r = db.prepare('SELECT id, metrics_json FROM posts WHERE channel_id = ? AND external_id = ?').get(channelId, externalId) as Row | undefined;
  if (!r) return false;
  const merged = { ...(JSON.parse(String(r.metrics_json)) as object), ...metrics };
  db.prepare('UPDATE posts SET metrics_json = ? WHERE id = ?').run(JSON.stringify(merged), String(r.id));
  return true;
}

export function parkMetrics(platform: PlatformId, channelExternalId: string, postExternalId: string, metrics: Partial<Record<MetricKey, MetricValue>>) {
  getDb()
    .prepare(
      `INSERT INTO pending_metrics (platform, channel_external_id, post_external_id, metrics_json, received_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (platform, channel_external_id, post_external_id) DO UPDATE SET metrics_json = excluded.metrics_json, received_at = excluded.received_at`,
    )
    .run(platform, channelExternalId, postExternalId, JSON.stringify(metrics), nowIso());
}

export function takeParkedMetrics(platform: PlatformId, channelExternalId: string, postExternalId: string): Partial<Record<MetricKey, MetricValue>> | null {
  const r = getDb()
    .prepare('DELETE FROM pending_metrics WHERE platform = ? AND channel_external_id = ? AND post_external_id = ? RETURNING metrics_json')
    .get(platform, channelExternalId, postExternalId) as Row | undefined;
  return r ? (JSON.parse(String(r.metrics_json)) as Partial<Record<MetricKey, MetricValue>>) : null;
}

export function maxExternalPostId(channelId: string): number {
  const r = getDb().prepare('SELECT MAX(CAST(external_id AS INTEGER)) AS m FROM posts WHERE channel_id = ?').get(channelId) as Row;
  return Number(r.m ?? 0);
}

/** Record an inbound update id; false if we've already processed it. */
export function markUpdateProcessed(platform: PlatformId, updateId: string): boolean {
  const r = getDb().prepare('INSERT OR IGNORE INTO processed_updates (platform, update_id, received_at) VALUES (?, ?, ?)').run(platform, updateId, nowIso());
  return Number(r.changes) === 1;
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export type ReminderStatus = 'sending' | 'sent' | 'retry' | 'failed' | 'no_recipient';
export const MAX_REMINDER_ATTEMPTS = 3;

export interface ReminderLogEntry {
  key: string;
  localDate: string;
  status: ReminderStatus;
  attempts: number;
  message: string;
  lastError: string | null;
  updatedAt: string;
}

const toLog = (r: Row): ReminderLogEntry => ({
  key: String(r.key),
  localDate: String(r.local_date),
  status: r.status as ReminderStatus,
  attempts: Number(r.attempts),
  message: String(r.message),
  lastError: str(r.last_error),
  updatedAt: String(r.updated_at),
});

/** Keys that should not be sent again (everything except retryable failures). */
export function settledReminderKeys(userId: string): Set<string> {
  const rows = getDb().prepare("SELECT key FROM reminder_log WHERE user_id = ? AND NOT (status = 'retry' AND attempts < ?)").all(userId, MAX_REMINDER_ATTEMPTS) as Row[];
  return new Set(rows.map((r) => String(r.key)));
}

/**
 * Claim the right to send a reminder. Inserts a new row, or re-claims a
 * retryable one. Only one caller can win, even with overlapping cron runs.
 */
export function claimReminder(key: string, userId: string, localDate: string, message: string): boolean {
  const db = getDb();
  const now = nowIso();
  const inserted = db
    .prepare("INSERT OR IGNORE INTO reminder_log (key, user_id, local_date, status, attempts, message, created_at, updated_at) VALUES (?, ?, ?, 'sending', 1, ?, ?, ?)")
    .run(key, userId, localDate, message, now, now);
  if (Number(inserted.changes) === 1) return true;
  const retried = db
    .prepare("UPDATE reminder_log SET status = 'sending', attempts = attempts + 1, updated_at = ? WHERE key = ? AND status = 'retry' AND attempts < ?")
    .run(now, key, MAX_REMINDER_ATTEMPTS);
  return Number(retried.changes) === 1;
}

export function finishReminder(key: string, status: Exclude<ReminderStatus, 'sending'>, error: string | null = null) {
  getDb().prepare('UPDATE reminder_log SET status = ?, last_error = ?, updated_at = ? WHERE key = ?').run(status, error, nowIso(), key);
}

export function recentReminders(userId: string, limit = 5): ReminderLogEntry[] {
  return (getDb().prepare('SELECT * FROM reminder_log WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?').all(userId, limit) as Row[]).map(toLog);
}

// ─── Development outbox ──────────────────────────────────────────────────────

export function addDevOutbox(userId: string, text: string) {
  getDb().prepare('INSERT INTO dev_outbox (user_id, text, created_at) VALUES (?, ?, ?)').run(userId, text, nowIso());
}

export function listDevOutbox(userId: string, limit = 5): { text: string; createdAt: string }[] {
  return (getDb().prepare('SELECT text, created_at FROM dev_outbox WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit) as Row[]).map((r) => ({
    text: String(r.text),
    createdAt: String(r.created_at),
  }));
}
