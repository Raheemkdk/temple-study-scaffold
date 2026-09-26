import { sessionUserId } from '@/lib/auth/sessions';
import { getDb } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const userId = sessionUserId(request);
  if (!userId) return Response.json({ error: 'Sign in to view events' }, { status: 401 });
  const db = getDb();
  const assignments = db.prepare(`SELECT id, title, due_at AS dueAt, source_timezone AS sourceTimezone,
    source_date AS sourceDate, date_only AS dateOnly, completed, reminder_eligible AS reminderEligible
    FROM assignments WHERE user_id = ? ORDER BY due_at LIMIT 500`).all(userId);
  const connection = db.prepare('SELECT last_synced_at AS lastSyncedAt FROM canvas_connections WHERE user_id = ?')
    .get(userId) as { lastSyncedAt: string | null } | undefined;
  return Response.json({ assignments: assignments.map((row) => ({ ...row, dateOnly: !!row.dateOnly,
    completed: !!row.completed, reminderEligible: !!row.reminderEligible, sourceType: 'canvas' })),
    lastSyncedAt: connection?.lastSyncedAt ?? null, hasCanvasFeed: !!connection });
}
