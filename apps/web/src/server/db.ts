import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config';

/**
 * SQLite via Node's built-in `node:sqlite`: no extra service to run for the
 * MVP. All access goes through `repo.ts`, so moving to Postgres later means
 * re-implementing that one module.
 *
 * Timestamps are stored as ISO-8601 UTC strings; calendar days are always
 * derived per creator time zone in the domain layer, never stored.
 */

const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    telegram_user_id TEXT UNIQUE,
    telegram_name TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE link_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );

  -- user_id is NULL while a channel is unclaimed (bot added before the
  -- creator linked their account); it is claimed once ownership is proven.
  CREATE TABLE channels (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    handle TEXT,
    status TEXT NOT NULL,
    status_detail TEXT,
    source TEXT NOT NULL,
    added_by_external_user TEXT,
    connected_at TEXT NOT NULL,
    last_event_at TEXT,
    member_count INTEGER,
    UNIQUE (platform, external_id)
  );
  CREATE INDEX channels_user ON channels(user_id);

  CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    published_at TEXT NOT NULL,
    edited_at TEXT,
    kind TEXT NOT NULL,
    text_preview TEXT,
    url TEXT,
    source TEXT NOT NULL,
    metrics_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE (channel_id, external_id)
  );
  CREATE INDEX posts_channel_time ON posts(channel_id, published_at);

  -- Reaction counts can arrive before we've stored the post (or for posts
  -- from before tracking); they're parked here and applied if the post appears.
  CREATE TABLE pending_metrics (
    platform TEXT NOT NULL,
    channel_external_id TEXT NOT NULL,
    post_external_id TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    received_at TEXT NOT NULL,
    PRIMARY KEY (platform, channel_external_id, post_external_id)
  );

  -- One row per (user, local date). The primary key is the idempotency
  -- guarantee: a reminder is claimed by inserting the row before sending.
  CREATE TABLE reminder_log (
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    local_date TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX reminder_log_user ON reminder_log(user_id, local_date);

  -- Development mode only: messages the simulated bot "sent".
  CREATE TABLE dev_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Webhook update ids we've processed, so Telegram retries are no-ops.
  CREATE TABLE processed_updates (
    platform TEXT NOT NULL,
    update_id TEXT NOT NULL,
    received_at TEXT NOT NULL,
    PRIMARY KEY (platform, update_id)
  );
  `,
];

function migrate(db: DatabaseSync) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[i]!);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

const globalForDb = globalThis as unknown as { __emberlyDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.__emberlyDb) {
    mkdirSync(config.dataDir, { recursive: true });
    const db = new DatabaseSync(path.join(config.dataDir, 'emberly.db'));
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    migrate(db);
    globalForDb.__emberlyDb = db;
  }
  return globalForDb.__emberlyDb;
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
