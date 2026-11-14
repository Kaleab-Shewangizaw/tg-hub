// Local development with a real bot, no public URL needed:
// long-polls getUpdates and forwards each update to the local webhook route.
// Usage: pnpm telegram:poll [--delete-webhook]
import { need } from './_env.mjs';

const token = need('TELEGRAM_BOT_TOKEN');
const secret = need('TELEGRAM_WEBHOOK_SECRET');
const local = (process.env.LOCAL_URL ?? 'http://localhost:3000') + '/api/telegram/webhook';
const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => r.json());

const info = await api('getWebhookInfo');
if (info.result?.url) {
  if (!process.argv.includes('--delete-webhook')) {
    console.error(`This bot has a webhook set (${info.result.url}). getUpdates won't work while it's set.\nRe-run with --delete-webhook to remove it (you can restore it with pnpm telegram:set-webhook).`);
    process.exit(1);
  }
  await api('deleteWebhook');
  console.log('Webhook removed.');
}

let offset = 0;
console.log(`Polling Telegram and forwarding to ${local} … (Ctrl+C to stop)`);
for (;;) {
  const r = await api('getUpdates', {
    offset,
    timeout: 30,
    allowed_updates: ['message', 'channel_post', 'edited_channel_post', 'message_reaction_count', 'my_chat_member'],
  });
  if (!r.ok) {
    console.error('getUpdates failed:', r.description);
    await new Promise((res) => setTimeout(res, 5000));
    continue;
  }
  for (const update of r.result) {
    const res = await fetch(local, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) }).catch((e) => ({ ok: false, status: e.message }));
    console.log(`update ${update.update_id} → ${res.status}`);
    if (!res.ok) {
      console.error('Local server rejected the update; will retry it.');
      await new Promise((r2) => setTimeout(r2, 3000));
      break;
    }
    offset = update.update_id + 1;
  }
}
