#!/usr/bin/env python3
"""
Export a Telegram channel's full post history for Emberly.

Bots can't read posts from before they joined a channel, so this script signs
in as *your* Telegram account (via Telethon) on your own machine and writes a
file in the Telegram Desktop "Export chat history → JSON" format. Upload that
file in Emberly under Channels → Import history. Your Telegram login never
leaves your computer; the session file stays next to this script.

Setup (once):
  1. Get an api_id and api_hash at https://my.telegram.org → API development tools.
  2. pip install telethon

Run:
  TG_API_ID=12345 TG_API_HASH=abc123 python3 scripts/telegram-history.py <channel> [-o out.json]

<channel> is a public @username, a t.me link, or the numeric id of a channel you
are a member of. The first run asks for your phone number and login code.
"""

import argparse
import json
import os
import sys

try:
    from telethon.sync import TelegramClient
    from telethon.tl import types
except ImportError:
    sys.exit("Telethon is not installed. Run: pip install telethon")


def text_of(message):
    # message.message is the raw text or caption, without formatting markup.
    return message.message or ""


def media_fields(message):
    """Map Telethon media onto the fields Telegram Desktop exports use."""
    m = message.media
    if m is None:
        return {}
    if isinstance(m, types.MessageMediaPhoto):
        return {"photo": "(photo)"}
    if isinstance(m, types.MessageMediaPoll):
        q = m.poll.question
        return {"poll": {"question": getattr(q, "text", q)}}
    if isinstance(m, types.MessageMediaDocument):
        if message.voice:
            return {"media_type": "voice_message", "file": "(voice)"}
        if message.video_note:
            return {"media_type": "video_message", "file": "(video)"}
        if message.gif:
            return {"media_type": "animation", "file": "(animation)"}
        if message.video:
            return {"media_type": "video_file", "file": "(video)"}
        if message.audio:
            return {"media_type": "audio_file", "file": "(audio)"}
        if message.sticker:
            return {"media_type": "sticker", "file": "(sticker)"}
        return {"file": "(file)"}
    return {}


def reactions_of(message):
    r = message.reactions
    if not r or not r.results:
        return None
    out = []
    for item in r.results:
        reaction = item.reaction
        if isinstance(reaction, types.ReactionEmoji):
            out.append({"type": "emoji", "emoji": reaction.emoticon, "count": item.count})
        elif isinstance(reaction, types.ReactionCustomEmoji):
            out.append({"type": "custom_emoji", "count": item.count})
        else:  # ReactionPaid and future kinds
            out.append({"type": "paid", "count": item.count})
    return out


def main():
    parser = argparse.ArgumentParser(description="Export a Telegram channel's history for Emberly.")
    parser.add_argument("channel", help="@username, t.me link or numeric channel id")
    parser.add_argument("-o", "--out", help="output file (default: <channel>-history.json)")
    parser.add_argument("--session", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "telegram-history"),
                        help="where Telethon keeps your login session (keep it private)")
    args = parser.parse_args()

    api_id = os.environ.get("TG_API_ID") or input("api_id: ").strip()
    api_hash = os.environ.get("TG_API_HASH") or input("api_hash: ").strip()
    target = args.channel.strip()
    target = int(target) if target.lstrip("-").isdigit() else target

    with TelegramClient(args.session, int(api_id), api_hash) as client:
        entity = client.get_entity(target)
        if not isinstance(entity, types.Channel) or entity.megagroup:
            sys.exit("That's not a channel. Emberly tracks broadcast channels, not groups or chats.")

        messages = []
        skipped = 0
        for message in client.iter_messages(entity, limit=None):
            if not isinstance(message, types.Message) or message.action is not None:
                skipped += 1  # service messages (channel created, photo changed, …)
                continue
            item = {
                "id": message.id,
                "type": "message",
                "date": message.date.replace(tzinfo=None).isoformat(),
                "date_unixtime": str(int(message.date.timestamp())),
                "text": text_of(message),
                **media_fields(message),
            }
            if message.edit_date:
                item["edited_unixtime"] = str(int(message.edit_date.timestamp()))
            reactions = reactions_of(message)
            if reactions is not None:
                item["reactions"] = reactions
            messages.append(item)
            if len(messages) % 500 == 0:
                print(f"  {len(messages)} posts…", file=sys.stderr)

    messages.reverse()  # oldest first, like Telegram Desktop
    export = {
        "name": entity.title,
        "type": "public_channel" if entity.username else "private_channel",
        "id": entity.id,  # bare id; Emberly adds the -100 prefix the Bot API uses
        "messages": messages,
    }
    out = args.out or f"{entity.username or entity.id}-history.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=1)
    print(f"Exported {len(messages)} posts from “{entity.title}” to {out} ({skipped} service messages skipped).")
    print("Upload it in Emberly: Channels → Import history.")


if __name__ == "__main__":
    main()
