# Telegram: what the Bot API allows

Checked against the official Bot API docs (core.telegram.org/bots/api), **Bot API 10.4, 9 Nov 2026**. Releases 10.2 to 10.4 added nothing for channel analytics, views or message history.

| Need | Possible? | How / limitation | What Emberly does |
| --- | --- | --- | --- |
| See new channel posts | Yes | `channel_post` / `edited_channel_post` updates once the bot is in the channel (bots join channels as admins). | Records time, type, a 140-char preview and the link (public channels). |
| Read posts from before the bot joined | **No** | No history method for bots. Pending updates are kept for at most 24 h. | **Fallback:** import a Telegram Desktop export (JSON). Days before tracking are shown as "untracked", never as missed. |
| Reaction counts | Yes, with conditions | `message_reaction_count`: the bot must be an **admin**, the update must be **listed explicitly** in `allowed_updates`, counts are **anonymous totals per reaction**, and updates may arrive **grouped and delayed by a few minutes**. | Stores totals and the per-emoji breakdown. Shows "Reactions arriving…" for fresh posts. Reactions that arrive before their post are parked and applied later. |
| Per-user reactions | No (channels) | Channel reactions are anonymous. | Not collected. |
| Views, forwards, comment counts | **No** | Not exposed to bots for channel posts. | Shown as "not available" with the reason. Never zero, never estimated. |
| Subscriber count | Yes | `getChatMemberCount`. | Fetched when a channel is verified. |
| Know when the bot is added/removed/demoted | Yes | `my_chat_member` with old/new status and the acting admin (`from`). | Updates connection status (Tracking / Needs attention / Not tracking). Auto-claims a channel when the admin who added the bot is a linked user. |
| Verify the creator manages a channel | Yes | `getChatMember(channel, user)` → `creator` / `administrator`. | Required before claiming a channel by @username. |
| Message the creator (reminders) | Only after they start the bot | Bots can't start conversations. A user must open the bot and press Start. | Deep link `t.me/<bot>?start=<token>`. The payload allows `A-Z a-z 0-9 _ -` and ≤64 chars. We use a 32-char one-time token that expires after 30 min. |
| Webhook authenticity | Yes | `secret_token` on `setWebhook` → `X-Telegram-Bot-Api-Secret-Token` header. | Constant-time compare; retries de-duplicated by `update_id`. |
| Rate limits | Soft | Flood control returns 429 with `retry_after`. Broadcasts ~30 msg/s by default. | Reminders: 429/5xx → retried by the next cron run (max 3 attempts). 403 (bot blocked) → not retried. |

## Required bot setup

- Admin in the channel. No permissions need to be on, because admin status alone is what makes Telegram deliver posts and reaction counts.
- `allowed_updates`: `message`, `channel_post`, `edited_channel_post`, `message_reaction_count`, `my_chat_member`. Both helper scripts set these.

## Beyond the Bot API (not built)

View, forward and stats data exist in Telegram's **MTProto** user API (`stats.getBroadcastStats`, message views). Using it means the creator signs in with their own Telegram account (phone + code) and we hold a user session. That is a significant trust and security step, so it would need an explicit opt-in design. Statistics are also only available for larger channels.
