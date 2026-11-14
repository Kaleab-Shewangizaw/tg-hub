import { userFromRequest } from '@/server/auth';
import { loadDashboard } from '@/server/dashboard';

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  return Response.json(loadDashboard(user));
}
