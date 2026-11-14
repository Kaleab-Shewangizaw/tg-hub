'use server';

import { refresh } from 'next/cache';
import type { ChannelVerification } from '@emberly/core';
import { ExportFormatError } from '@emberly/telegram';
import { requireUser } from '@/server/auth';
import { runReminderJob } from '@/server/reminders';
import * as repo from '@/server/repo';
import * as tg from '@/server/telegram';

export async function startLinkAction(): Promise<tg.LinkStart> {
  const user = await requireUser();
  return tg.startTelegramLink(user.id);
}

export async function unlinkTelegramAction() {
  const user = await requireUser();
  repo.setTelegramAccount(user.id, null, null);
  refresh();
}

export type VerifyState = { result: ChannelVerification | null; error: string | null };

export async function verifyChannelAction(_prev: VerifyState, fd: FormData): Promise<VerifyState> {
  const user = await requireUser();
  const ref = String(fd.get('channel') ?? '').trim();
  if (!ref) return { result: null, error: 'Enter your channel’s @username or its numeric id.' };
  try {
    const result = await tg.verifyTelegramChannel(user, ref);
    refresh();
    return { result, error: null };
  } catch {
    return { result: null, error: 'We couldn’t reach Telegram just now. Please try again in a minute.' };
  }
}

export type ImportState = { message: string | null; error: string | null };

export async function importExportAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireUser();
  const file = fd.get('export');
  if (!(file instanceof File) || file.size === 0) return { message: null, error: 'Choose the result.json file from your Telegram export.' };
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { message: null, error: 'That file isn’t valid JSON. In Telegram Desktop, choose “Machine-readable JSON” as the format.' };
  }
  try {
    const r = tg.importTelegramExport(user, json);
    refresh();
    return {
      message: `Imported ${r.added} post${r.added === 1 ? '' : 's'} into ${r.channelTitle}${r.updated ? ` (${r.updated} already recorded)` : ''}.`,
      error: null,
    };
  } catch (e) {
    return { message: null, error: e instanceof ExportFormatError || e instanceof Error ? e.message : 'Import failed.' };
  }
}

export async function removeChannelAction(fd: FormData) {
  const user = await requireUser();
  const channel = repo.getChannel(String(fd.get('channelId')));
  if (channel && channel.userId === user.id) repo.deleteChannel(channel.id);
  refresh();
}

// ─── Development simulator ───────────────────────────────────────────────────

export async function simulateLinkAction() {
  await tg.simulateLink(await requireUser());
  refresh();
}

export async function simulateAddChannelAction(fd: FormData) {
  await tg.simulateAddChannel(await requireUser(), String(fd.get('title') ?? ''));
  refresh();
}

export async function simulatePostAction(fd: FormData) {
  await tg.simulatePost(await requireUser(), String(fd.get('channelId')), String(fd.get('text') ?? ''));
  refresh();
}

export async function simulateReactionsAction(fd: FormData) {
  await tg.simulateReactions(await requireUser(), String(fd.get('channelId')));
  refresh();
}

export async function runRemindersNowAction() {
  const user = await requireUser();
  await runReminderJob(new Date(), user.id);
  refresh();
}
