'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdmin, requireAdmin } from '@/server/auth';
import { validateHandle } from '@/server/handles';
import * as repo from '@/server/repo';

/**
 * Admin actions. Every one re-checks admin rights on the server, refuses to
 * let an admin lock themselves out, and writes an audit-log entry.
 */

const field = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

async function target(fd: FormData) {
  const admin = await requireAdmin();
  const user = repo.getUser(field(fd, 'userId'));
  return { admin, user };
}

function log(admin: repo.UserRecord, action: string, user: { id: string; name: string; handle: string } | null, detail?: string) {
  repo.addAdminLog({ adminId: admin.id, adminName: admin.name, action, targetId: user?.id, targetLabel: user ? `${user.name} (@${user.handle})` : null, detail });
}

export async function setRoleAction(fd: FormData) {
  const { admin, user } = await target(fd);
  if (!user || user.id === admin.id) return;
  const role: repo.UserRole = field(fd, 'role') === 'admin' ? 'admin' : 'user';
  repo.setUserRole(user.id, role);
  log(admin, role === 'admin' ? 'Made admin' : 'Removed admin', user);
  refresh();
}

export async function setSuspendedAction(fd: FormData) {
  const { admin, user } = await target(fd);
  if (!user || user.id === admin.id) return;
  const suspend = field(fd, 'suspend') === '1';
  if (suspend && isAdmin(user)) return; // Remove admin rights first.
  repo.setUserSuspended(user.id, suspend);
  log(admin, suspend ? 'Suspended' : 'Reinstated', user);
  refresh();
}

export async function revokeSessionsAction(fd: FormData) {
  const { admin, user } = await target(fd);
  if (!user || user.id === admin.id) return;
  const n = repo.revokeUserSessions(user.id);
  log(admin, 'Signed out everywhere', user, `${n} session${n === 1 ? '' : 's'}`);
  refresh();
}

export interface AdminEditState {
  ok: boolean;
  error: string | null;
}

export async function updateUserAction(_prev: AdminEditState, fd: FormData): Promise<AdminEditState> {
  const { admin, user } = await target(fd);
  if (!user) return { ok: false, error: 'That account no longer exists.' };
  const name = field(fd, 'name');
  const email = field(fd, 'email');
  const handle = field(fd, 'handle').replace(/^@/, '').toLowerCase();
  if (name.length < 1 || name.length > 60) return { ok: false, error: 'Name must be 1–60 characters.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const handleError = validateHandle(handle);
  if (handleError) return { ok: false, error: handleError };
  const error = repo.adminUpdateUser(user.id, { name, email, handle });
  if (error) return { ok: false, error };
  const changed = [name !== user.name && 'name', email.toLowerCase() !== user.email.toLowerCase() && 'email', handle !== user.handle && 'handle'].filter(Boolean);
  if (changed.length) log(admin, 'Edited profile', { id: user.id, name, handle }, `Changed ${changed.join(', ')}`);
  refresh();
  return { ok: true, error: null };
}

export interface DeleteUserState {
  error: string | null;
}

export async function deleteUserAction(_prev: DeleteUserState, fd: FormData): Promise<DeleteUserState> {
  const { admin, user } = await target(fd);
  if (!user) redirect('/admin/users');
  if (user.id === admin.id) return { error: 'You can’t delete your own account here.' };
  if (field(fd, 'confirm').replace(/^@/, '').toLowerCase() !== user.handle) return { error: `Type ${user.handle} to confirm.` };
  repo.deleteUser(user.id);
  log(admin, 'Deleted account', user, user.email);
  redirect('/admin/users');
}

export async function channelAction(fd: FormData) {
  const admin = await requireAdmin();
  const channel = repo.getChannel(field(fd, 'channelId'));
  if (!channel) return;
  const owner = channel.userId ? repo.getUser(channel.userId) : null;
  const label = { id: channel.id, name: channel.title, handle: channel.handle ?? channel.externalId };
  if (field(fd, 'intent') === 'delete') {
    repo.deleteChannel(channel.id);
    log(admin, 'Deleted channel', label, owner ? `Owned by @${owner.handle}` : 'Unclaimed');
  } else if (field(fd, 'intent') === 'release' && owner) {
    repo.releaseChannel(channel.id);
    log(admin, 'Released channel', label, `From @${owner.handle}`);
  }
  refresh();
}
