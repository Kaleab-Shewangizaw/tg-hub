// Make an existing account an admin (or revoke with --revoke).
//   pnpm --filter web admin:grant you@example.com
//   pnpm --filter web admin:grant you@example.com --revoke
// Alternatively, list emails in ADMIN_EMAILS (comma-separated) in .env.local.
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import './_env.mjs';

const email = process.argv[2];
const revoke = process.argv.includes('--revoke');
if (!email || email.startsWith('--')) {
  console.error('Usage: pnpm --filter web admin:grant <email> [--revoke]');
  process.exit(1);
}
const db = new DatabaseSync(path.join(process.env.DATA_DIR ?? path.join(process.cwd(), 'data'), 'emberly.db'));
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!cols.includes('role')) {
  console.error('The database is not migrated yet. Start the app once (pnpm dev) and try again.');
  process.exit(1);
}
const r = db.prepare('UPDATE users SET role = ? WHERE email = ? COLLATE NOCASE').run(revoke ? 'user' : 'admin', email.trim());
if (Number(r.changes) === 0) {
  console.error(`No account with email ${email}.`);
  process.exit(1);
}
console.log(revoke ? `${email} is no longer an admin.` : `${email} is now an admin. Open /admin.`);
