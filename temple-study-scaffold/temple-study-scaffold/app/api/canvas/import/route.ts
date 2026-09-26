import { sameOrigin, sessionUserId } from '@/lib/auth/sessions';
import { CanvasImportError, importCanvasFeed } from '@/lib/canvas/import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  const userId = sessionUserId(request);
  if (!userId) return Response.json({ error: 'Sign in to import a feed' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Expected a JSON object' }, { status: 400 });
  }
  const feedUrl = (body as Record<string, unknown>).feedUrl;
  if (feedUrl !== undefined && (typeof feedUrl !== 'string' || !feedUrl || feedUrl.length > 2048)) {
    return Response.json({ error: 'Invalid feed URL' }, { status: 400 });
  }
  try {
    return Response.json(await importCanvasFeed(userId, feedUrl));
  } catch (error) {
    if (error instanceof CanvasImportError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Canvas import failed' }, { status: 500 });
  }
}
