import { settingsSchema } from '@emberly/core';
import { userFromRequest } from '@/server/auth';
import { saveSettings } from '@/server/repo';

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  return Response.json(user.settings);
}

export async function PUT(request: Request) {
  const user = userFromRequest(request);
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid settings', issues: parsed.error.issues }, { status: 400 });
  saveSettings(user.id, parsed.data);
  return Response.json(parsed.data);
}
