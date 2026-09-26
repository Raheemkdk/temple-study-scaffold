// TODO: Owner 4: send an explicitly labeled immediate test push.
// Contract and privacy requirements: docs/API.md. No feature logic is implemented here.
export const runtime = 'nodejs';

export async function POST() {
  return Response.json({ error: 'Not implemented' }, { status: 501 });
}
