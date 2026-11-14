// Triggers the reminder job once (what a scheduler would call every 15 minutes).
import { need } from './_env.mjs';

const url = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '') + '/api/cron/reminders';
const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${need('CRON_SECRET')}` } });
console.log(res.status, await res.json());
