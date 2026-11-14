import 'server-only';
import { isValidTimeZone, signInSchema, signUpSchema } from '@emberly/core';
import { burnPasswordCheck, hashPassword, verifyPassword } from './auth';
import * as repo from './repo';

export type FieldErrors = Partial<Record<string, string>>;
export type AccountResult = { ok: true; user: repo.UserRecord } | { ok: false; error: string; fieldErrors?: FieldErrors };

function flatten(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) out[String(i.path[0] ?? 'form')] ??= i.message;
  return out;
}

export async function signUp(input: { name: unknown; email: unknown; password: unknown; timeZone: unknown }): Promise<AccountResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the highlighted fields.', fieldErrors: flatten(parsed.error.issues) };
  const tz = typeof input.timeZone === 'string' && isValidTimeZone(input.timeZone) ? input.timeZone : 'UTC';
  const user = repo.createUser({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
    settings: repo.defaultSettings(tz),
  });
  if (!user) return { ok: false, error: 'An account with this email already exists. Try signing in.', fieldErrors: { email: 'Already registered' } };
  return { ok: true, user };
}

export async function signIn(input: { email: unknown; password: unknown }): Promise<AccountResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the highlighted fields.', fieldErrors: flatten(parsed.error.issues) };
  const creds = repo.getUserCredentials(parsed.data.email);
  if (!creds) {
    await burnPasswordCheck(parsed.data.password);
    return { ok: false, error: 'That email and password don’t match an account.' };
  }
  if (!(await verifyPassword(parsed.data.password, creds.passwordHash))) {
    return { ok: false, error: 'That email and password don’t match an account.' };
  }
  return { ok: true, user: repo.getUser(creds.id)! };
}
