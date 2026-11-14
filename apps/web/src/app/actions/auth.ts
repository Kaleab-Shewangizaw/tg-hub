'use server';

import { redirect } from 'next/navigation';
import { signIn, signUp, type FieldErrors } from '@/server/accounts';
import { endWebSession, startWebSession } from '@/server/auth';

export type AuthFormState = { error: string | null; fieldErrors?: FieldErrors; values?: Record<string, string> };

const field = (fd: FormData, key: string) => String(fd.get(key) ?? '');

export async function signUpAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const result = await signUp({ name: field(fd, 'name'), email: field(fd, 'email'), password: field(fd, 'password'), timeZone: field(fd, 'timeZone') });
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values: { name: field(fd, 'name'), email: field(fd, 'email') } };
  await startWebSession(result.user.id);
  redirect('/app/channels');
}

export async function signInAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const result = await signIn({ email: field(fd, 'email'), password: field(fd, 'password') });
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values: { email: field(fd, 'email') } };
  await startWebSession(result.user.id);
  redirect('/app');
}

export async function signOutAction() {
  await endWebSession();
  redirect('/');
}
