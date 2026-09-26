import { scryptSync, timingSafeEqual } from 'node:crypto';
import { sameOrigin, startSession } from '@/lib/auth/sessions';
import { getDb } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return Response.json({ error: 'Invalid credentials' }, { status: 400 });
  const { email, password } = input as Record<string, unknown>;
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 256) {
    return Response.json({ error: 'Invalid credentials' }, { status: 400 });
  }
  const row = getDb().prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as { id: string; email: string; password_hash: string } | undefined;
  if (!row) return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  const [salt, expected] = row.password_hash.split(':');
  const actual = scryptSync(password, salt, 64);
  if (!timingSafeEqual(actual, Buffer.from(expected, 'hex'))) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  const response = Response.json({ id: row.id, email: row.email });
  startSession(row.id, request, response);
  return response;
}
