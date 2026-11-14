import { revokeBearer } from '@/server/auth';

export async function POST(request: Request) {
  revokeBearer(request);
  return Response.json({ ok: true });
}
