// TODO: Owner 4: return public VAPID key or register a browser push subscription.
// Contract and privacy requirements: docs/API.md. No feature logic is implemented here.
export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ error: 'Not implemented' }, { status: 501 });
}

export async function POST() {
  return Response.json({ error: 'Not implemented' }, { status: 501 });
}
