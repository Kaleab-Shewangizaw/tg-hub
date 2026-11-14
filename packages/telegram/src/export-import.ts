import type { ChannelRef, NormalizedPost, PostKind } from '@emberly/core';
import { preview, reactionsMetric } from './parse';

/**
 * Backfill from a Telegram Desktop export ("Export chat history" → JSON).
 *
 * The Bot API cannot read posts published before the bot joined, so this is
 * the practical way to fill in a creator's history. Reactions are included
 * only when the export file itself contains them; we never estimate.
 */

interface ExportTextPart {
  text?: string;
}

interface ExportMessage {
  id: number;
  type: string;
  date?: string;
  date_unixtime?: string;
  edited_unixtime?: string;
  text?: string | (string | ExportTextPart)[];
  photo?: string;
  media_type?: string;
  file?: string;
  mime_type?: string;
  poll?: { question?: string };
  reactions?: { type?: string; count?: number; emoji?: string }[];
}

interface ExportFile {
  name?: string;
  type?: string;
  id?: number;
  messages?: ExportMessage[];
}

export interface ExportImportResult {
  channel: ChannelRef;
  posts: NormalizedPost[];
  skipped: number;
}

export class ExportFormatError extends Error {}

function flattenText(text: ExportMessage['text']): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.map((p) => (typeof p === 'string' ? p : p.text ?? '')).join('');
}

function kindOf(m: ExportMessage): PostKind {
  if (m.photo) return 'photo';
  switch (m.media_type) {
    case 'video_file':
    case 'animation':
    case 'video_message':
      return 'video';
    case 'voice_message':
      return 'voice';
    case 'audio_file':
      return 'audio';
    case 'sticker':
      return 'sticker';
  }
  if (m.poll) return 'poll';
  if (m.file) return 'document';
  return flattenText(m.text) ? 'text' : 'other';
}

export function parseTelegramExport(json: unknown, importedAt = new Date()): ExportImportResult {
  const data = json as ExportFile;
  if (!data || typeof data !== 'object' || !Array.isArray(data.messages)) {
    throw new ExportFormatError('This doesn’t look like a Telegram Desktop JSON export (missing "messages").');
  }
  if (data.type && !/channel/.test(data.type)) {
    throw new ExportFormatError('This export is from a chat or group, not a channel.');
  }
  if (typeof data.id !== 'number') throw new ExportFormatError('The export is missing the channel id.');

  const posts: NormalizedPost[] = [];
  let skipped = 0;
  for (const m of data.messages) {
    const ts = Number(m.date_unixtime);
    if (m.type !== 'message' || !Number.isFinite(ts)) {
      skipped += 1; // service messages (channel created, photo changed, …)
      continue;
    }
    const reactions = (m.reactions ?? [])
      .filter((r) => typeof r.count === 'number' && r.count >= 0)
      .map((r) => ({ label: r.type === 'emoji' && r.emoji ? r.emoji : r.type === 'paid' ? '⭐ Paid' : 'Custom emoji', count: r.count! }));
    posts.push({
      externalId: String(m.id),
      publishedAt: new Date(ts * 1000).toISOString(),
      editedAt: m.edited_unixtime ? new Date(Number(m.edited_unixtime) * 1000).toISOString() : null,
      kind: kindOf(m),
      textPreview: preview(flattenText(m.text) || m.poll?.question),
      url: null,
      metrics: m.reactions ? { reactions: reactionsMetric(reactions, importedAt.toISOString()) } : {},
    });
  }

  return {
    // Exports use the bare channel id; the Bot API prefixes channel ids with -100.
    channel: { externalId: `-100${data.id}`, title: data.name ?? 'Imported channel', handle: null },
    posts,
    skipped,
  };
}
