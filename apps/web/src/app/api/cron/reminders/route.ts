import { timingSafeEqual } from 'node:crypto';
import { config } from '@/server/config';
import { runReminderJob } from '@/server/reminders';

/**
 * Run the reminder job. Call every 15 minutes from any scheduler (Vercel
 * Cron, GitHub Actions, systemd timer, `pnpm reminders:run`) with
 * `Authorization: Bearer $CRON_SECRET`. Safe to retry or overlap.
 */
function authorized(request: Request): boolean {
  const expected = config.cronSecret;
  const got = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!config.cronSecret) return Response.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const summary = await runReminderJob(new Date());
  return Response.json(summary);
}

export const GET = handle;
export const POST = handle;
