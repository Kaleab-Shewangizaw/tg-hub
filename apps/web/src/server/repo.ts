import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Channel, ConnectionStatus, DataSource, MetricKey, MetricValue, NormalizedPost, PlatformId, Post, SettingsInput } from '@emberly/core';
import { getDb, transaction } from './db';
import { uniqueHandle } from './handles';

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
  /** Public profile URL segment: /u/<handle>. */
  handle: string;
  bio: string | null;
  profilePublic: boolean;
  role: UserRole;
  suspendedAt: string | null;
  lastSeenAt: string | null;
  /** Send a Telegram message when a medal or tier is earned. */
  notifyMedals: boolean;
}

export type UserRole = 'user' | 'admin';

type Row = Record<string, unknown>;
const nowIso = () => new Date().toISOString();
const str = (v: unknown) => (v == null ? null : String(v));

export function defaultSettings(timeZone: string): UserSettings {
  return {
    cadence: { kind: 'weekly', postsPerWeek: 3 },
    timeZone,
    weekStartsOn: 1,
    pauses: [],
    reminders: { enabled: true, time: '18:00', days: [1, 2, 3, 4, 5], quietHours: { start: '22:00', end: '08:00' } },
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
    handle: String(r.handle ?? ''),
    bio: str(r.bio),
    profilePublic: r.profile_public == null ? true : Number(r.profile_public) === 1,
    role: r.role === 'admin' ? 'admin' : 'user',
    suspendedAt: str(r.suspended_at),
    lastSeenAt: str(r.last_seen_at),
    notifyMedals: r.notify_medals == null ? true : Number(r.notify_medals) === 1,
  };
}

export function createUser(input: { email: string; name: string; passwordHash: string; settings: UserSettings }): UserRecord | null {
  const id = randomUUID();
  const handle = uniqueHandle(input.name, (h) => handleTaken(h));
  try {
    getDb()
      .prepare('INSERT INTO users (id, email, name, password_hash, settings_json, created_at, handle) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.email.trim(), input.name.trim(), input.passwordHash, JSON.stringify(input.settings), nowIso(), handle);
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

export function getUserCredentials(email: string): { id: string; passwordHash: string; suspended: boolean } | null {
  const r = getDb().prepare('SELECT id, password_hash, suspended_at FROM users WHERE email = ?').get(email.trim()) as Row | undefined;
  return r ? { id: String(r.id), passwordHash: String(r.password_hash), suspended: r.suspended_at != null } : null;
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
  // A Telegram account can be linked to one Tally account at a time.
  if (telegramUserId) db.prepare('UPDATE users SET telegram_user_id = NULL, telegram_name = NULL WHERE telegram_user_id = ? AND id != ?').run(telegramUserId, userId);
  db.prepare('UPDATE users SET telegram_user_id = ?, telegram_name = ? WHERE id = ?').run(telegramUserId, telegramName, userId);
}

export function insertSession(tokenHash: string, userId: string, kind: 'web' | 'mobile', expiresAt: Date) {
  getDb().prepare('INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(tokenHash, userId, kind, nowIso(), expiresAt.toISOString());
}

/** Suspended accounts never resolve to a session. Also records "last seen" (at most every 5 minutes). */
export function findSessionUser(tokenHash: string): UserRecord | null {
  const db = getDb();
  const now = nowIso();
  const r = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.suspended_at IS NULL')
    .get(tokenHash, now) as Row | undefined;
  if (!r) return null;
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  if (!r.last_seen_at || String(r.last_seen_at) < stale) {
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, String(r.id));
    r.last_seen_at = now;
  }
  return toUser(r);
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

// ─── Profiles, follows & stars ───────────────────────────────────────────────

export function handleTaken(handle: string, exceptUserId: string | null = null): boolean {
  const r = getDb().prepare('SELECT id FROM users WHERE handle = ?').get(handle) as Row | undefined;
  return !!r && r.id !== exceptUserId;
}

export function getUserByHandle(handle: string): UserRecord | null {
  const r = getDb().prepare('SELECT * FROM users WHERE handle = ?').get(handle) as Row | undefined;
  return r ? toUser(r) : null;
}

/** Returns false when the handle is already taken. */
export function updateProfile(userId: string, input: { name: string; handle: string; bio: string | null; profilePublic: boolean }): boolean {
  if (handleTaken(input.handle, userId)) return false;
  try {
    getDb()
      .prepare('UPDATE users SET name = ?, handle = ?, bio = ?, profile_public = ? WHERE id = ?')
      .run(input.name, input.handle, input.bio, input.profilePublic ? 1 : 0, userId);
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) return false;
    throw e;
  }
  return true;
}

export function follow(followerId: string, followeeId: string) {
  if (followerId === followeeId) return;
  getDb().prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)').run(followerId, followeeId, nowIso());
}

export function unfollow(followerId: string, followeeId: string) {
  getDb().prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(followerId, followeeId);
}

export function isFollowing(followerId: string, followeeId: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?').get(followerId, followeeId);
}

/** Counts only public accounts, matching what the lists show. */
export function followCounts(userId: string): { followers: number; following: number } {
  const db = getDb();
  const followers = db
    .prepare('SELECT COUNT(*) AS n FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ? AND u.profile_public = 1')
    .get(userId) as { n: number };
  const following = db
    .prepare('SELECT COUNT(*) AS n FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? AND u.profile_public = 1')
    .get(userId) as { n: number };
  return { followers: Number(followers.n), following: Number(following.n) };
}

export interface ProfileSummary {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  followers: number;
  posts: number;
}

const SUMMARY_COLUMNS = `u.id, u.name, u.handle, u.bio,
  (SELECT COUNT(*) FROM follows f2 JOIN users fu ON fu.id = f2.follower_id WHERE f2.followee_id = u.id AND fu.profile_public = 1) AS followers,
  (SELECT COUNT(*) FROM posts p JOIN channels c ON c.id = p.channel_id WHERE c.user_id = u.id) AS posts`;

function toSummary(r: Row): ProfileSummary {
  return { id: String(r.id), name: String(r.name), handle: String(r.handle), bio: str(r.bio), followers: Number(r.followers), posts: Number(r.posts) };
}

export function listFollowers(userId: string, limit = 100): ProfileSummary[] {
  return (
    getDb()
      .prepare(
        `SELECT ${SUMMARY_COLUMNS} FROM follows f JOIN users u ON u.id = f.follower_id
         WHERE f.followee_id = ? AND u.profile_public = 1 ORDER BY f.created_at DESC LIMIT ?`,
      )
      .all(userId, limit) as Row[]
  ).map(toSummary);
}

export function listFollowing(userId: string, limit = 100): ProfileSummary[] {
  return (
    getDb()
      .prepare(
        `SELECT ${SUMMARY_COLUMNS} FROM follows f JOIN users u ON u.id = f.followee_id
         WHERE f.follower_id = ? AND u.profile_public = 1 ORDER BY f.created_at DESC LIMIT ?`,
      )
      .all(userId, limit) as Row[]
  ).map(toSummary);
}

/** Public creators who have at least one channel, most followed first. */
export function listPublicProfiles(limit = 24): ProfileSummary[] {
  return (
    getDb()
      .prepare(
        `SELECT ${SUMMARY_COLUMNS} FROM users u
         WHERE u.profile_public = 1 AND u.suspended_at IS NULL AND EXISTS (SELECT 1 FROM channels c WHERE c.user_id = u.id)
         ORDER BY followers DESC, posts DESC, u.created_at DESC LIMIT ?`,
      )
      .all(limit) as Row[]
  ).map(toSummary);
}

/** Which of `userIds` the viewer follows. */
export function followedAmong(viewerId: string, userIds: string[]): Set<string> {
  if (userIds.length === 0) return new Set();
  const rows = getDb()
    .prepare(`SELECT followee_id FROM follows WHERE follower_id = ? AND followee_id IN (${userIds.map(() => '?').join(',')})`)
    .all(viewerId, ...userIds) as Row[];
  return new Set(rows.map((r) => String(r.followee_id)));
}

export function starChannel(userId: string, channelId: string) {
  getDb().prepare('INSERT OR IGNORE INTO channel_stars (user_id, channel_id, created_at) VALUES (?, ?, ?)').run(userId, channelId, nowIso());
}

export function unstarChannel(userId: string, channelId: string) {
  getDb().prepare('DELETE FROM channel_stars WHERE user_id = ? AND channel_id = ?').run(userId, channelId);
}

/** Star counts per channel, plus which ones the viewer has starred. */
export function channelStars(channelIds: string[], viewerId: string | null): { counts: Map<string, number>; mine: Set<string> } {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (channelIds.length === 0) return { counts, mine };
  const marks = channelIds.map(() => '?').join(',');
  const db = getDb();
  for (const r of db.prepare(`SELECT channel_id, COUNT(*) AS n FROM channel_stars WHERE channel_id IN (${marks}) GROUP BY channel_id`).all(...channelIds) as Row[]) {
    counts.set(String(r.channel_id), Number(r.n));
  }
  if (viewerId) {
    for (const r of db.prepare(`SELECT channel_id FROM channel_stars WHERE user_id = ? AND channel_id IN (${marks})`).all(viewerId, ...channelIds) as Row[]) {
      mine.add(String(r.channel_id));
    }
  }
  return { counts, mine };
}

// ─── Admin ───────────────────────────────────────────────────────────────────

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const count = (sql: string, ...args: (string | number)[]) => Number((getDb().prepare(sql).get(...args) as { n: number }).n);

export interface AdminStats {
  users: number;
  admins: number;
  suspended: number;
  newUsers7d: number;
  newUsers30d: number;
  active7d: number;
  creators: number;
  channels: number;
  channelsByStatus: Record<string, number>;
  unclaimedChannels: number;
  posts: number;
  posts7d: number;
  posts30d: number;
  follows: number;
  stars: number;
  activeSessions: number;
  remindersSent7d: number;
}

/** `extraAdminEmails`: admins granted by configuration rather than role. */
export function adminStats(extraAdminEmails: Iterable<string> = []): AdminStats {
  const extra = [...extraAdminEmails];
  const d7 = daysAgoIso(7);
  const d30 = daysAgoIso(30);
  const byStatus: Record<string, number> = {};
  for (const r of getDb().prepare('SELECT status, COUNT(*) AS n FROM channels GROUP BY status').all() as Row[]) byStatus[String(r.status)] = Number(r.n);
  return {
    users: count('SELECT COUNT(*) AS n FROM users'),
    admins: count(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' OR lower(email) IN (${extra.map(() => '?').join(',') || "''"})`, ...extra),
    suspended: count('SELECT COUNT(*) AS n FROM users WHERE suspended_at IS NOT NULL'),
    newUsers7d: count('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', d7),
    newUsers30d: count('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', d30),
    active7d: count('SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= ?', d7),
    creators: count('SELECT COUNT(DISTINCT user_id) AS n FROM channels WHERE user_id IS NOT NULL'),
    channels: count('SELECT COUNT(*) AS n FROM channels'),
    channelsByStatus: byStatus,
    unclaimedChannels: count('SELECT COUNT(*) AS n FROM channels WHERE user_id IS NULL'),
    posts: count('SELECT COUNT(*) AS n FROM posts'),
    posts7d: count('SELECT COUNT(*) AS n FROM posts WHERE published_at >= ?', d7),
    posts30d: count('SELECT COUNT(*) AS n FROM posts WHERE published_at >= ?', d30),
    follows: count('SELECT COUNT(*) AS n FROM follows'),
    stars: count('SELECT COUNT(*) AS n FROM channel_stars'),
    activeSessions: count('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?', nowIso()),
    remindersSent7d: count("SELECT COUNT(*) AS n FROM reminder_log WHERE status = 'sent' AND updated_at >= ?", d7),
  };
}

/** Daily counts (UTC days) for the last `days` days, oldest first, zero-filled. */
export function adminDailySeries(kind: 'signups' | 'posts', days = 30): { date: string; n: number }[] {
  const since = daysAgoIso(days - 1).slice(0, 10);
  const sql =
    kind === 'signups'
      ? 'SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY d'
      : 'SELECT substr(published_at, 1, 10) AS d, COUNT(*) AS n FROM posts WHERE published_at >= ? GROUP BY d';
  const map = new Map((getDb().prepare(sql).all(since) as Row[]).map((r) => [String(r.d), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const date = daysAgoIso(days - 1 - i).slice(0, 10);
    return { date, n: map.get(date) ?? 0 };
  });
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  handle: string;
  role: UserRole;
  suspendedAt: string | null;
  profilePublic: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  telegramName: string | null;
  channels: number;
  posts: number;
  followers: number;
  lastPostAt: string | null;
}

export type AdminUserFilter = 'all' | 'admins' | 'suspended' | 'creators' | 'no-channel' | 'private';
export type AdminUserSort = 'joined' | 'name' | 'posts' | 'followers' | 'seen';

const ADMIN_USER_SORT: Record<AdminUserSort, string> = {
  joined: 'u.created_at',
  name: 'u.name COLLATE NOCASE',
  posts: 'posts',
  followers: 'followers',
  seen: "COALESCE(u.last_seen_at, '')",
};

const ADMIN_USER_FILTER: Record<AdminUserFilter, string> = {
  all: '1 = 1',
  admins: "u.role = 'admin'",
  suspended: 'u.suspended_at IS NOT NULL',
  creators: 'EXISTS (SELECT 1 FROM channels c WHERE c.user_id = u.id)',
  'no-channel': 'NOT EXISTS (SELECT 1 FROM channels c WHERE c.user_id = u.id)',
  private: 'u.profile_public = 0',
};

export function adminListUsers(opts: { q?: string; filter?: AdminUserFilter; sort?: AdminUserSort; dir?: 'asc' | 'desc'; limit?: number; offset?: number }): {
  rows: AdminUserRow[];
  total: number;
} {
  const filter = ADMIN_USER_FILTER[opts.filter ?? 'all'] ?? ADMIN_USER_FILTER.all;
  const sort = ADMIN_USER_SORT[opts.sort ?? 'joined'] ?? ADMIN_USER_SORT.joined;
  const dir = opts.dir === 'asc' ? 'ASC' : 'DESC';
  const q = opts.q?.trim() ? `%${opts.q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const where = `${filter}${q ? " AND (u.name LIKE ?1 ESCAPE '\\' OR u.email LIKE ?1 ESCAPE '\\' OR u.handle LIKE ?1 ESCAPE '\\')" : ''}`;
  const args = q ? [q] : [];
  const db = getDb();
  const total = Number((db.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${where}`).get(...args) as Row).n);
  const rows = db
    .prepare(
      `SELECT u.*,
         (SELECT COUNT(*) FROM channels c WHERE c.user_id = u.id) AS channels,
         (SELECT COUNT(*) FROM posts p JOIN channels c ON c.id = p.channel_id WHERE c.user_id = u.id) AS posts,
         (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers,
         (SELECT MAX(p.published_at) FROM posts p JOIN channels c ON c.id = p.channel_id WHERE c.user_id = u.id) AS last_post_at
       FROM users u WHERE ${where}
       ORDER BY ${sort} ${dir}, u.created_at DESC
       LIMIT ${Math.max(1, Math.min(opts.limit ?? 50, 200))} OFFSET ${Math.max(0, opts.offset ?? 0)}`,
    )
    .all(...args) as Row[];
  return {
    total,
    rows: rows.map((r) => {
      const u = toUser(r);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        handle: u.handle,
        role: u.role,
        suspendedAt: u.suspendedAt,
        profilePublic: u.profilePublic,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt,
        telegramName: u.telegramName,
        channels: Number(r.channels),
        posts: Number(r.posts),
        followers: Number(r.followers),
        lastPostAt: str(r.last_post_at),
      };
    }),
  };
}

export interface AdminChannelRow extends ChannelRecord {
  ownerName: string | null;
  ownerHandle: string | null;
  posts: number;
  stars: number;
  lastPostAt: string | null;
}

export function adminListChannels(opts: { q?: string; status?: string; userId?: string } = {}): AdminChannelRow[] {
  const clauses: string[] = [];
  const args: string[] = [];
  if (opts.userId) {
    clauses.push('c.user_id = ?');
    args.push(opts.userId);
  }
  if (opts.status === 'unclaimed') clauses.push('c.user_id IS NULL');
  else if (opts.status) {
    clauses.push('c.status = ?');
    args.push(opts.status);
  }
  if (opts.q?.trim()) {
    clauses.push("(c.title LIKE ? ESCAPE '\\' OR c.handle LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
    const q = `%${opts.q.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`;
    args.push(q, q, q);
  }
  const rows = getDb()
    .prepare(
      `SELECT c.*, u.name AS owner_name, u.handle AS owner_handle,
         (SELECT COUNT(*) FROM posts p WHERE p.channel_id = c.id) AS posts,
         (SELECT COUNT(*) FROM channel_stars s WHERE s.channel_id = c.id) AS stars,
         (SELECT MAX(published_at) FROM posts p WHERE p.channel_id = c.id) AS last_post_at
       FROM channels c LEFT JOIN users u ON u.id = c.user_id
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY c.connected_at DESC LIMIT 500`,
    )
    .all(...args) as Row[];
  return rows.map((r) => ({
    ...toChannel(r),
    ownerName: str(r.owner_name),
    ownerHandle: str(r.owner_handle),
    posts: Number(r.posts),
    stars: Number(r.stars),
    lastPostAt: str(r.last_post_at),
  }));
}

export function listUserSessions(userId: string): { kind: string; createdAt: string; expiresAt: string }[] {
  return (getDb().prepare('SELECT kind, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC').all(userId, nowIso()) as Row[]).map((r) => ({
    kind: String(r.kind),
    createdAt: String(r.created_at),
    expiresAt: String(r.expires_at),
  }));
}

export function setUserRole(userId: string, role: UserRole) {
  getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
}

/** Suspending also signs the account out everywhere. */
export function setUserSuspended(userId: string, suspended: boolean) {
  transaction(() => {
    getDb().prepare('UPDATE users SET suspended_at = ? WHERE id = ?').run(suspended ? nowIso() : null, userId);
    if (suspended) revokeUserSessions(userId);
  });
}

export function revokeUserSessions(userId: string): number {
  return Number(getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId).changes);
}

/** Returns an error message, or null on success. */
export function adminUpdateUser(userId: string, input: { name: string; email: string; handle: string }): string | null {
  if (handleTaken(input.handle, userId)) return 'That handle is taken.';
  try {
    getDb().prepare('UPDATE users SET name = ?, email = ?, handle = ? WHERE id = ?').run(input.name, input.email, input.handle, userId);
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) return 'That email or handle is already in use.';
    throw e;
  }
  return null;
}

/** Deletes the account and everything it owns (sessions, channels, posts, follows). */
export function deleteUser(userId: string) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/** Detach a channel from its owner so it can be claimed again. */
export function releaseChannel(channelId: string) {
  getDb().prepare('UPDATE channels SET user_id = NULL WHERE id = ?').run(channelId);
}

export interface AdminLogEntry {
  id: number;
  adminId: string;
  adminName: string;
  action: string;
  targetId: string | null;
  targetLabel: string | null;
  detail: string | null;
  createdAt: string;
}

export function addAdminLog(entry: { adminId: string; adminName: string; action: string; targetId?: string | null; targetLabel?: string | null; detail?: string | null }) {
  getDb()
    .prepare('INSERT INTO admin_log (admin_id, admin_name, action, target_id, target_label, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(entry.adminId, entry.adminName, entry.action, entry.targetId ?? null, entry.targetLabel ?? null, entry.detail ?? null, nowIso());
}

export function listAdminLog(opts: { limit?: number; targetId?: string } = {}): AdminLogEntry[] {
  const rows = (
    opts.targetId
      ? getDb().prepare('SELECT * FROM admin_log WHERE target_id = ? ORDER BY id DESC LIMIT ?').all(opts.targetId, opts.limit ?? 50)
      : getDb().prepare('SELECT * FROM admin_log ORDER BY id DESC LIMIT ?').all(opts.limit ?? 50)
  ) as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    adminId: String(r.admin_id),
    adminName: String(r.admin_name),
    action: String(r.action),
    targetId: str(r.target_id),
    targetLabel: str(r.target_label),
    detail: str(r.detail),
    createdAt: String(r.created_at),
  }));
}

/** When each star on this user's channels was given (for the Starstruck medal). */
export function starTimesForOwner(userId: string): string[] {
  return (
    getDb()
      .prepare('SELECT s.created_at FROM channel_stars s JOIN channels c ON c.id = s.channel_id WHERE c.user_id = ? AND s.user_id <> ? ORDER BY s.created_at')
      .all(userId, userId) as Row[]
  ).map((r) => String(r.created_at));
}

// ─── App settings (managed in admin) ────────────────────────────────────────

export function getAppSetting(key: string): string | null {
  const r = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as Row | undefined;
  return r ? String(r.value) : null;
}

export function setAppSetting(key: string, value: string | null) {
  if (value == null) getDb().prepare('DELETE FROM app_settings WHERE key = ?').run(key);
  else getDb().prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, value, nowIso());
}

// ─── Medal notices ───────────────────────────────────────────────────────────

export function hasMedalNotices(userId: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM medal_notices WHERE user_id = ? LIMIT 1').get(userId);
}

/** Claims the right to announce (user, medal, tier). True only the first time. */
export function claimMedalNotice(userId: string, medalId: string, tier: number): boolean {
  const r = getDb().prepare('INSERT OR IGNORE INTO medal_notices (user_id, medal_id, tier, created_at) VALUES (?, ?, ?, ?)').run(userId, medalId, tier, nowIso());
  return Number(r.changes) === 1;
}

export function setNotifyMedals(userId: string, on: boolean) {
  getDb().prepare('UPDATE users SET notify_medals = ? WHERE id = ?').run(on ? 1 : 0, userId);
}

/** Owners of the given channels (for medal checks after an update). */
export function ownersOfChannels(platform: PlatformId, externalIds: string[]): string[] {
  if (externalIds.length === 0) return [];
  const rows = getDb()
    .prepare(`SELECT DISTINCT user_id FROM channels WHERE platform = ? AND user_id IS NOT NULL AND external_id IN (${externalIds.map(() => '?').join(',')})`)
    .all(platform, ...externalIds) as Row[];
  return rows.map((r) => String(r.user_id));
}

export function countTelegramLinked(): number {
  return Number((getDb().prepare('SELECT COUNT(*) AS n FROM users WHERE telegram_user_id IS NOT NULL').get() as Row).n);
}

/** First and last post time and post count, per channel. */
export function channelPostStats(channelIds: string[]): Map<string, { posts: number; firstPostAt: string | null; lastPostAt: string | null }> {
  const out = new Map<string, { posts: number; firstPostAt: string | null; lastPostAt: string | null }>();
  if (channelIds.length === 0) return out;
  const rows = getDb()
    .prepare(`SELECT channel_id, COUNT(*) AS n, MIN(published_at) AS first, MAX(published_at) AS last FROM posts WHERE channel_id IN (${channelIds.map(() => '?').join(',')}) GROUP BY channel_id`)
    .all(...channelIds) as Row[];
  for (const r of rows) out.set(String(r.channel_id), { posts: Number(r.n), firstPostAt: str(r.first), lastPostAt: str(r.last) });
  return out;
}
