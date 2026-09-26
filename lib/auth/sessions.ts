import { createHash, randomBytes } from 'node:crypto';
import { getDb } from '@/lib/db/client';

const COOKIE = 'temple_session';
const SESSION_SECONDS = 60 * 60 * 24 * 14;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

export function sessionUserId(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = getDb().prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .get(tokenHash(token), new Date().toISOString()) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export function startSession(userId: string, request: Request, response: Response): void {
  const token = randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  getDb().prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(token), userId, expiry);
  response.headers.append('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
}

export function endSession(request: Request, response: Response): void {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  }
  response.headers.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
}
