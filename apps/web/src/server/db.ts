import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config';
import { uniqueHandle } from './handles';

/**
 * SQLite via Node's built-in `node:sqlite`: no extra service to run for the
 * MVP. All access goes through `repo.ts`, so moving to Postgres later means
 * re-implementing that one module.
 *
 * Timestamps are stored as ISO-8601 UTC strings; calendar days are always
 * derived per creator time zone in the domain layer, never stored.
 */

type Migration = string | ((db: DatabaseSync) => void);

const MIGRATIONS: Migration[] = [
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
  // 2: public profiles, follows and channel stars.
  (db) => {
    db.exec(`
      ALTER TABLE users ADD COLUMN handle TEXT COLLATE NOCASE;
      ALTER TABLE users ADD COLUMN bio TEXT;
      ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 1;

      CREATE TABLE follows (
        follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (follower_id, followee_id),
        CHECK (follower_id <> followee_id)
      );
      CREATE INDEX follows_followee ON follows(followee_id);

      CREATE TABLE channel_stars (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, channel_id)
      );
      CREATE INDEX channel_stars_channel ON channel_stars(channel_id);
    `);
    // Give every existing account a handle derived from its name.
    const taken = new Set<string>();
    const users = db.prepare('SELECT id, name FROM users ORDER BY created_at').all() as { id: string; name: string }[];
    const set = db.prepare('UPDATE users SET handle = ? WHERE id = ?');
    for (const u of users) {
      const h = uniqueHandle(u.name, (c) => taken.has(c));
      taken.add(h);
      set.run(h, u.id);
    }
    db.exec('CREATE UNIQUE INDEX users_handle ON users(handle)');
  },
  // 3: admin roles, suspensions, last-seen and an audit log of admin actions.
  `
  ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  ALTER TABLE users ADD COLUMN suspended_at TEXT;
  ALTER TABLE users ADD COLUMN last_seen_at TEXT;
  CREATE INDEX users_created ON users(created_at);

  -- No foreign keys: the log outlives the accounts it mentions.
  CREATE TABLE admin_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    target_label TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX admin_log_time ON admin_log(created_at);
  `,
  // 4: settings managed in the admin panel (bot), and medal messages already sent.
  `
  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- One row per (user, medal, tier) we've announced. The primary key makes
  -- each announcement happen at most once, even with concurrent updates.
  CREATE TABLE medal_notices (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medal_id TEXT NOT NULL,
    tier INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, medal_id, tier)
  );

  ALTER TABLE users ADD COLUMN notify_medals INTEGER NOT NULL DEFAULT 1;
  `,
];

function migrate(db: DatabaseSync) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      const m = MIGRATIONS[i]!;
      if (typeof m === 'string') db.exec(m);
      else m(db);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

const globalForDb = globalThis as unknown as { __emberlyDb?: DatabaseSync };

// Reset whenever this module is (re)loaded, so a dev server that keeps the
// connection across hot reloads still applies newly added migrations.
let migrated = false;

export function getDb(): DatabaseSync {
  if (!globalForDb.__emberlyDb) {
    mkdirSync(config.dataDir, { recursive: true });
    const db = new DatabaseSync(path.join(config.dataDir, 'emberly.db'));
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    globalForDb.__emberlyDb = db;
  }
  if (!migrated) {
    migrate(globalForDb.__emberlyDb);
    migrated = true;
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
