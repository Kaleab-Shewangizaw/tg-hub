import { signUp } from '@/server/accounts';
import { createSessionToken } from '@/server/auth';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await signUp({ name: body.name, email: body.email, password: body.password, timeZone: body.timeZone });
  if (!result.ok) return Response.json(result, { status: 400 });
  const { token, expiresAt } = createSessionToken(result.user.id, 'mobile');
  return Response.json({ ok: true, token, expiresAt: expiresAt.toISOString(), user: { name: result.user.name, email: result.user.email } });
}
