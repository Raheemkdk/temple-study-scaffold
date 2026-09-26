import { sessionUserId } from '@/lib/auth/sessions';
import { getDb } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const userId = sessionUserId(request);
  if (!userId) return Response.json({ authenticated: false }, { status: 401 });
  const user = getDb().prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
  return Response.json({ authenticated: true, user });
}
