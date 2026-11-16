import 'server-only';
import path from 'node:path';

/**
 * All secrets live in server-side environment variables. Nothing here is
 * exposed to client bundles (`server-only` enforces that at build time).
 */
const env = (key: string) => {
  const v = process.env[key]?.trim();
  return v ? v : null;
};

export const config = {
  appUrl: env('APP_URL') ?? 'http://localhost:3000',
  dataDir: env('DATA_DIR') ?? path.join(process.cwd(), 'data'),
  telegram: {
    botToken: env('TELEGRAM_BOT_TOKEN'),
    botUsername: env('TELEGRAM_BOT_USERNAME')?.replace(/^@/, '') ?? null,
    webhookSecret: env('TELEGRAM_WEBHOOK_SECRET'),
  },
  cronSecret: env('CRON_SECRET'),
  /** Comma-separated emails that always have admin access (bootstrap). */
  adminEmails: new Set(
    (env('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
};

export type IntegrationMode = 'live' | 'development';
