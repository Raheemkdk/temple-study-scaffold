import { endSession, sameOrigin } from '@/lib/auth/sessions';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  const response = Response.json({ ok: true });
  endSession(request, response);
  return response;
}
