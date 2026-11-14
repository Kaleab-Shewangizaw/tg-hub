// Registers the production webhook with Telegram.
// Usage: pnpm telegram:set-webhook   (uses APP_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET)
import { need } from './_env.mjs';

const token = need('TELEGRAM_BOT_TOKEN');
const secret = need('TELEGRAM_WEBHOOK_SECRET');
const appUrl = need('APP_URL').replace(/\/$/, '');
if (!appUrl.startsWith('https://')) {
  console.error('APP_URL must be a public https:// URL for webhooks. For local development use `pnpm telegram:poll` instead.');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: `${appUrl}/api/telegram/webhook`,
    secret_token: secret,
    // message_reaction_count is not delivered unless listed explicitly.
    allowed_updates: ['message', 'channel_post', 'edited_channel_post', 'message_reaction_count', 'my_chat_member'],
  }),
});
console.log(await res.json());
