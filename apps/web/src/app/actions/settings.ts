'use server';

import { refresh } from 'next/cache';
import { settingsSchema } from '@emberly/core';
import { requireUser } from '@/server/auth';
import { saveSettings, setNotifyMedals } from '@/server/repo';

export type SaveSettingsResult = { ok: true } | { ok: false; error: string };

export async function saveSettingsAction(input: unknown): Promise<SaveSettingsResult> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : 'Please check your settings.' };
  }
  saveSettings(user.id, parsed.data);
  refresh();
  return { ok: true };
}

/** Settings → Telegram messages: turn medal messages on or off. */
export async function setNotifyMedalsAction(on: boolean) {
  const user = await requireUser();
  setNotifyMedals(user.id, on);
  refresh();
}
