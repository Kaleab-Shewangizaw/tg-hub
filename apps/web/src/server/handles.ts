/**
 * Public profile handles: /u/<handle>. Lowercase letters, digits and single
 * hyphens, 3–30 characters. Compared case-insensitively in the database.
 */

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/;

const RESERVED = new Set([
  'admin', 'api', 'app', 'demo', 'emberly', 'explore', 'help', 'me', 'new', 'settings', 'sign-in', 'sign-up', 'support', 'u', 'www',
]);

export function validateHandle(handle: string): string | null {
  if (!HANDLE_RE.test(handle)) return 'Use 3–30 lowercase letters, numbers or hyphens.';
  if (RESERVED.has(handle)) return 'That handle is reserved. Try another.';
  return null;
}

/** "Ada Lovelace" → "ada-lovelace". Always returns something valid-shaped. */
export function slugifyHandle(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
  const padded = base.length >= 3 ? base : `${base || 'creator'}${base ? '-creator' : ''}`;
  return RESERVED.has(padded) ? `${padded}-1` : padded;
}

/** First free handle based on `name`, using `isTaken` to probe. */
export function uniqueHandle(name: string, isTaken: (h: string) => boolean): string {
  const base = slugifyHandle(name);
  if (!isTaken(base)) return base;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base.slice(0, 25)}-${i}`;
    if (!isTaken(candidate)) return candidate;
  }
  return `${base.slice(0, 20)}-${Date.now().toString(36)}`;
}
