# Emberly

A calm activity profile for Telegram channel creators. Emberly records when you post, shows it as a readable year grid, keeps streaks in **your** chosen cadence (daily, specific days, or N per week), treats rest days and planned breaks as neutral, sends at most one gentle reminder a day, and awards medals that explain exactly why they were earned.

> Working name: "Emberly". Everything (name, logo, palette, copy) is original and easy to rename.

## Repository layout

```
packages/core       Platform-neutral domain: types, time zones, grid, streaks,
                    goal progress, medals, reminder decisions, copy, validation,
                    the PlatformProvider interface and demo data. Pure + tested.
packages/telegram   Telegram adapter: Bot API types, update parser, Bot API client,
                    provider (verify channel, send reminder), Telegram Desktop
                    export importer, update simulator. Tested.
apps/web            Next.js 16 (App Router): landing, auth, dashboard, medals,
                    channel setup, settings, demo, plus the API used by mobile,
                    the Telegram webhook and the reminder cron endpoint.
apps/mobile         Expo SDK 58 + Expo Router: Today / Medals / Rhythm tabs
                    (native tabs), sign in, demo mode. Uses the web API.
docs/               Telegram constraints and the plan for adding X.
```

### Key decisions

| Decision | Why |
| --- | --- |
| **Backend = Next.js route handlers + server actions** | One deployable for web UI, mobile API, webhook and cron. No separate service to run. |
| **SQLite via Node's built-in `node:sqlite`** | Zero extra infrastructure or dependencies for the MVP. All SQL lives in `apps/web/src/server/repo.ts`. Swap that module for Postgres before running on serverless or multiple instances. |
| **Email + password accounts, opaque session tokens** | Self-contained. Passwords use scrypt, and only SHA-256 hashes of tokens are stored. The web app uses an httpOnly cookie and mobile sends a Bearer token. |
| **Telegram account linked via bot deep link** | `t.me/<bot>?start=<one-time token>` proves account ownership *and* is required before a bot may DM the user (reminders). |
| **Channel ownership** | A channel is claimed only when (a) the linked Telegram user is the admin who added the bot, or (b) `getChatMember` confirms the linked user is the channel's creator/admin. |
| **Medals are derived, not stored** | Same posts → same medals. No drift, nothing to backfill, every award cites its evidence. |
| **Calendar days are computed per creator time zone** | Timestamps are stored in UTC; `Intl` turns them into local days (DST-safe, tested). |

## Running it

Requires Node 22+ (Node 26 tested) and pnpm 10.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # optional in development
pnpm dev                                       # web on http://localhost:3000
pnpm test                                      # core + telegram + web pipeline tests
pnpm typecheck
```

With no `TELEGRAM_BOT_TOKEN`, the web app runs in **development mode**:
- **Channels** offers a simulator. You can "press Start" in the bot, "add the bot" to a channel, publish posts and add reactions. Each action creates a real-shaped Telegram update that goes through the *same* parser and ingestion code as a live webhook. Simulated data is labelled "Simulated" everywhere.
- **Rhythm & reminders** has a "Run reminder check now" button. Reminders land in a simulated chat instead of Telegram.
- **/demo** shows a full dashboard with sample data and needs no account. It's labelled "Demo data".

### Mobile

```bash
# In apps/mobile/.env (or your shell). A device can't reach "localhost" on your computer:
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:3000
pnpm mobile          # then press i / a, or scan the QR code with Expo Go
```

"Explore the demo" works without the web server. Detailed setup (linking Telegram, adding the bot, imports, goal editing) happens on the web. The app covers daily use: today's progress, grid, streaks, recent posts, medals, and a reminders on/off switch.

## Going live with Telegram

You need **one Telegram bot** (free), and a **public HTTPS URL** for production webhooks.

1. In Telegram, message **@BotFather** → `/newbot` → copy the token.
2. In `apps/web/.env.local` set:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_BOT_USERNAME=your_bot_username
   TELEGRAM_WEBHOOK_SECRET=<random string: A-Z a-z 0-9 _ ->
   CRON_SECRET=<random string>
   APP_URL=https://your-domain.example
   ```
3. Receive updates:
   - **Production:** `pnpm telegram:set-webhook`. This registers `APP_URL/api/telegram/webhook` with the secret header and explicitly requests `message_reaction_count`, which Telegram leaves out by default.
   - **Local, no public URL:** run `pnpm dev` and `pnpm telegram:poll` together. The poller long-polls `getUpdates` and forwards each update to the local webhook route. It won't delete an existing webhook unless you pass `--delete-webhook`.
4. Schedule reminders: call `POST /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` every 15 minutes, using Vercel Cron, GitHub Actions, a systemd timer, or `pnpm reminders:run`. Runs are idempotent and safe to overlap.
5. Creator flow, in the app under **Channels**: Link Telegram → press Start in the bot → add the bot as a channel **administrator** (every permission can be turned off) → the channel connects automatically, or can be confirmed with "Check connection".

### Environment variables (server-side only)

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | prod | Public base URL (webhook registration, links). |
| `DATA_DIR` | no | Where `emberly.db` lives (default `apps/web/data`). |
| `TELEGRAM_BOT_TOKEN` | live mode | Bot token from BotFather. Absent = development mode. |
| `TELEGRAM_BOT_USERNAME` | recommended | For deep links; otherwise looked up with `getMe`. |
| `TELEGRAM_WEBHOOK_SECRET` | live mode | Verified against `X-Telegram-Bot-Api-Secret-Token`. |
| `CRON_SECRET` | for reminders | Protects the reminder endpoint. |
| `EXPO_PUBLIC_API_URL` | mobile | Web API base URL for the Expo app (not a secret). |

## What's real, what's mocked

| Area | Status |
| --- | --- |
| Accounts, sessions, settings, breaks | Real (SQLite). |
| Grid, streaks, progress, medals, reminder decisions | Real, computed from recorded posts. Unit tested. |
| Telegram webhook ingestion, account linking, channel verification, reminders via bot DM | Implemented against Bot API 10.4. Exercised end-to-end with simulated updates in tests. **Not yet run against a live bot**; that needs your token. |
| History import (Telegram Desktop JSON) | Real parser. Reactions are imported only if the export contains them. |
| Development simulator, `/demo`, mobile demo | Simulated/sample data, always labelled. |
| Views, forwards, comment counts | **Not collected.** The Bot API doesn't provide them. The UI explains this instead of showing zeros. |

See [`docs/telegram.md`](docs/telegram.md) for the platform constraints and [`docs/adding-x.md`](docs/adding-x.md) for the X plan.

## Known limitations / next steps

- SQLite is single-instance. Move `repo.ts` to Postgres before deploying to serverless or multiple instances.
- One Emberly account owns a channel. Shared team access to a channel isn't modelled yet.
- Reminders go only through Telegram DM. Push notifications in the mobile app (Expo Notifications) would be a natural second channel.
- No email verification or password reset yet.
