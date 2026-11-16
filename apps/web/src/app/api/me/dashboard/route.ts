import { parseYear } from '@/components/YearList';
import { userFromRequest } from '@/server/auth';
import { loadDashboard } from '@/server/dashboard';

/** GET /api/me/dashboard[?year=2025]. Without a year the grid covers the last 12 months. */
export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  return Response.json(loadDashboard(user, new Date(), parseYear(new URL(request.url).searchParams.get('year'))));
}
