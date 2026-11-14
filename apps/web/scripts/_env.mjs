// Tiny .env.local loader for the helper scripts (no dependency needed).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

for (const file of ['.env.local', '.env']) {
  const p = path.join(process.cwd(), file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

export function need(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing ${key}. Add it to apps/web/.env.local (see .env.example).`);
    process.exit(1);
  }
  return v;
}
