// TODO: Owner 2/4: update local completion and cancel queued reminders.
// Contract and privacy requirements: docs/API.md. No feature logic is implemented here.
export const runtime = 'nodejs';

export async function PATCH() {
  return Response.json({ error: 'Not implemented' }, { status: 501 });
}
