import 'server-only';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { config } from './config';
import { deleteSession, findSessionUser, insertSession, type UserRecord } from './repo';

/**
 * Email + password accounts with opaque session tokens. The browser gets an
 * httpOnly cookie; the mobile app gets the same kind of token as a Bearer
 * credential. Only a SHA-256 of each token is stored.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1 };
export const SESSION_COOKIE = 'emberly_session';
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, { ...SCRYPT, N: Number(n) });
  return timingSafeEqual(expected, actual);
}

/** Run a dummy hash so unknown emails take as long as wrong passwords. */
export async function burnPasswordCheck(password: string) {
  await scrypt(password, Buffer.alloc(16), 64, SCRYPT);
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function createSessionToken(userId: string, kind: 'web' | 'mobile'): { token: string; expiresAt: Date } {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  insertSession(sha256(token), userId, kind, expiresAt);
  return { token, expiresAt };
}

export async function startWebSession(userId: string) {
  const { token, expiresAt } = createSessionToken(userId, 'web');
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function endWebSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(sha256(token));
  jar.delete(SESSION_COOKIE);
}

/**
 * Current user from the session cookie, or null. Reads the request, and
 * marks the render as request-time: session expiry and everything shown to a
 * signed-in user ("today", streaks) depend on the current time.
 */
export async function currentUser(): Promise<UserRecord | null> {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findSessionUser(sha256(token)) : null;
}

/** For server components and actions behind sign-in. */
export async function requireUser(): Promise<UserRecord> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  return user;
}

/** Admins are users with the admin role, plus anyone listed in ADMIN_EMAILS. */
export function isAdmin(user: Pick<UserRecord, 'role' | 'email'> | null): boolean {
  return !!user && (user.role === 'admin' || config.adminEmails.has(user.email.toLowerCase()));
}

/** For admin pages and actions. Non-admins get a 404, so the area stays invisible. */
export async function requireAdmin(): Promise<UserRecord> {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}

/** For API route handlers: Bearer token (mobile) or session cookie (web). */
export function userFromRequest(request: Request): UserRecord | null {
  const auth = request.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = request.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const token = bearer ?? (cookie ? decodeURIComponent(cookie) : null);
  return token ? findSessionUser(sha256(token)) : null;
}

export function revokeBearer(request: Request) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) deleteSession(sha256(bearer));
}
