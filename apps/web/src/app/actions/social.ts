'use server';

import { refresh } from 'next/cache';
import { requireUser } from '@/server/auth';
import { validateHandle } from '@/server/handles';
import { checkMedalsSafely } from '@/server/notify';
import * as repo from '@/server/repo';

/** Follow or unfollow a public creator. Form fields: handle, intent=follow|unfollow. */
export async function followAction(fd: FormData) {
  const user = await requireUser();
  const target = repo.getUserByHandle(String(fd.get('handle') ?? ''));
  if (!target || target.id === user.id) return;
  if (fd.get('intent') === 'unfollow') repo.unfollow(user.id, target.id);
  else if (target.profilePublic) repo.follow(user.id, target.id);
  refresh();
}

/** Star or unstar a channel on a public profile. Form fields: channelId, intent=star|unstar. */
export async function starAction(fd: FormData) {
  const user = await requireUser();
  const channel = repo.getChannel(String(fd.get('channelId') ?? ''));
  if (!channel?.userId) return;
  if (fd.get('intent') === 'unstar') {
    repo.unstarChannel(user.id, channel.id);
  } else {
    const owner = repo.getUser(channel.userId);
    if (!owner?.profilePublic) return;
    repo.starChannel(user.id, channel.id);
    await checkMedalsSafely([owner.id]); // Starstruck
  }
  refresh();
}

export interface ProfileFormState {
  ok: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<'name' | 'handle' | 'bio', string>>;
}

export async function saveProfileAction(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const name = String(fd.get('name') ?? '').trim();
  const handle = String(fd.get('handle') ?? '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  const bio = String(fd.get('bio') ?? '').trim();
  const profilePublic = fd.get('profilePublic') === 'on';

  const fieldErrors: ProfileFormState['fieldErrors'] = {};
  if (name.length < 1 || name.length > 60) fieldErrors.name = 'Use 1–60 characters.';
  const handleError = validateHandle(handle);
  if (handleError) fieldErrors.handle = handleError;
  if (bio.length > 160) fieldErrors.bio = 'Keep it to 160 characters.';
  if (Object.keys(fieldErrors).length) return { ok: false, error: null, fieldErrors };

  if (!repo.updateProfile(user.id, { name, handle, bio: bio || null, profilePublic })) {
    return { ok: false, error: null, fieldErrors: { handle: 'That handle is taken. Try another.' } };
  }
  refresh();
  return { ok: true, error: null };
}
