# Adding X (after Telegram)

The core never imports platform code. A platform plugs in through `PlatformProvider` (`packages/core/src/provider.ts`) and emits normalized `InboundEvent`s / `NormalizedPost`s.

## What would change

1. **New package `packages/x`** implementing `PlatformProvider`:
   - `capabilities`: `delivery: 'poll'`, `historicalSync: true` (recent timeline, within API tier limits). Metrics depend on the API tier: `likes`, `reposts`, `replies`, and `views` (impressions) on an account's own posts.
   - `syncPosts({ channelExternalId, since })`: fetch the user's posts since the last sync and map them to `NormalizedPost` with `metrics`.
   - `verifyChannel`: confirm the OAuth-connected account.
   - `sendReminder`: probably **not supported** (DMs need extra scopes and are intrusive). Reminders would stay on Telegram, or move to mobile push.
2. **Auth:** OAuth 2.0 with PKCE to connect an X account. Store refresh tokens server-side, encrypted. Add a `platform_accounts` table, or extend `users.telegram_user_id` into a general linked-accounts table.
3. **Sync job:** a cron route like `/api/cron/reminders` that calls `syncPosts` for each X channel and pipes results through `applyInboundEvents('x', …)`. Ingestion, storage, grid, streaks and medals don't change.
4. **Types:** `PlatformId` already includes `'x'`. `MetricKey` already covers likes, reposts, replies and views. `capabilitiesFor('x')` in `apps/web/src/server/platforms.ts` gets a branch.
5. **UI:** the Channels page grows a platform picker. The post list already renders whatever metrics the provider declares as supported, and explains the ones it doesn't.
6. **Cost:** X API access is a paid service with per-tier read limits. That's a product decision to make before building.

## What does *not* change

Grid, streaks, goal progress, medals (Crowd Favorite would naturally include likes once a "primary engagement metric" per platform is chosen), reminders, settings, demo mode, and the mobile app.
