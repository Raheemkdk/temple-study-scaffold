import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import ical, { type VEvent } from 'node-ical';
import { getDb } from '@/lib/db/client';

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS = 5000;

export class CanvasImportError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export function validateCanvasUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new CanvasImportError('Invalid Canvas feed URL', 400); }
  if (url.protocol !== 'https:' || url.hostname !== 'templeu.instructure.com' || url.port ||
      url.username || url.password || url.search || url.hash ||
      !/^\/feeds\/calendars\/user_[A-Za-z0-9_-]+\.ics$/.test(url.pathname)) {
    throw new CanvasImportError('Use a Temple Canvas calendar feed URL', 400);
  }
  return url.href;
}

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY || '';
  const key = /^[a-fA-F0-9]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be a 32-byte hex or base64 value');
  return key;
}

function encryptUrl(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function decryptUrl(value: string): string {
  const bytes = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}

async function downloadFeed(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new CanvasImportError('Could not download the Canvas feed', 502);
  }
  if (!response.ok || !response.body) throw new CanvasImportError('Canvas feed request failed', 502);
  const declaredLength = Number(response.headers.get('content-length'));
  if (declaredLength > MAX_FEED_BYTES) throw new CanvasImportError('Canvas feed is too large', 413);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_FEED_BYTES) throw new CanvasImportError('Canvas feed is too large', 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(chunks, length));
}

export type CanvasEvent = {
  uid: string;
  recurrenceId: string;
  title: string;
  dueAt: string;
  sourceTimezone: string | null;
  sourceDate: string | null;
  dateOnly: boolean;
};

function calendarDate(date: Date, timezone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return date.toISOString().slice(0, 10); }
}

export function parseCanvasFeed(body: string, now = new Date()): CanvasEvent[] {
  if (!/^BEGIN:VCALENDAR\s*$/m.test(body) || !/^END:VCALENDAR\s*$/m.test(body)) {
    throw new CanvasImportError('Invalid iCalendar feed', 422);
  }
  let parsed: ReturnType<typeof ical.sync.parseICS>;
  try { parsed = ical.sync.parseICS(body); } catch { throw new CanvasImportError('Invalid iCalendar feed', 422); }
  const events = new Map<string, CanvasEvent>();
  const add = (event: VEvent, recurrenceId = '') => {
    if (event.status === 'CANCELLED' || !event.uid || !event.start || !Number.isFinite(event.start.getTime())) return;
    const title = typeof event.summary === 'string' ? event.summary : event.summary?.val;
    const key = `${event.uid}\0${recurrenceId}`;
    const dateOnly = event.start.dateOnly === true || event.datetype === 'date';
    events.set(key, {
      uid: event.uid,
      recurrenceId,
      title: (title || 'Untitled event').slice(0, 500),
      dueAt: event.start.toISOString(),
      sourceTimezone: event.start.tz || null,
      sourceDate: dateOnly ? calendarDate(event.start, event.start.tz) : null,
      dateOnly,
    });
    if (events.size > MAX_EVENTS) throw new CanvasImportError('Canvas feed has too many events', 413);
  };
  // Expand recurring entries over a bounded window so an unbounded RRULE cannot
  // create an unlimited assignment list on every manual refresh.
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const to = new Date(now);
  to.setUTCFullYear(to.getUTCFullYear() + 2);
  for (const item of Object.values(parsed)) {
    if (!item || item.type !== 'VEVENT') continue;
    const event = item as VEvent;
    if (event.rrule) {
      if (!event.start || !Number.isFinite(event.start.getTime())) continue;
      if (/\bFREQ=(?:SECONDLY|MINUTELY|HOURLY)\b|\bBY(?:HOUR|MINUTE|SECOND)=/i.test(event.rrule.toString())) {
        throw new CanvasImportError('Recurring calendar event is too frequent', 422);
      }
      let instances: ReturnType<typeof ical.expandRecurringEvent>;
      try { instances = ical.expandRecurringEvent(event, { from, to }); }
      catch { throw new CanvasImportError('Invalid recurring calendar event', 422); }
      if (instances.length > MAX_EVENTS) throw new CanvasImportError('Canvas feed has too many events', 413);
      for (const instance of instances) {
        const recurrence = instance.isOverride ? instance.event.recurrenceid : instance.start;
        const recurrenceId = recurrence?.toISOString() === event.start.toISOString() ? '' : recurrence?.toISOString() || '';
        add({ ...instance.event, uid: event.uid, start: instance.start, summary: instance.summary } as VEvent, recurrenceId);
      }
      continue;
    }
    add(event, event.recurrenceid?.toISOString() || '');
    const uniqueOverrides = new Set(Object.values(event.recurrences || {}));
    for (const override of uniqueOverrides) {
      const recurrence = (override as VEvent).recurrenceid;
      add(override as VEvent, recurrence?.toISOString() || '');
    }
  }
  return [...events.values()];
}

export async function importCanvasFeed(userId: string, suppliedUrl?: string): Promise<{ importedCount: number; lastSyncedAt: string }> {
  const db = getDb();
  const connection = db.prepare('SELECT encrypted_url FROM canvas_connections WHERE user_id = ?')
    .get(userId) as { encrypted_url: string } | undefined;
  if (!suppliedUrl && !connection) throw new CanvasImportError('Add a Canvas feed before refreshing', 400);
  const url = validateCanvasUrl(suppliedUrl || decryptUrl(connection!.encrypted_url));
  const events = parseCanvasFeed(await downloadFeed(url));
  const syncedAt = new Date().toISOString();
  const syncMarker = randomUUID();
  const encryptedUrl = suppliedUrl ? encryptUrl(url) : connection!.encrypted_url;

  db.exec('BEGIN IMMEDIATE');
  try {
    const upsert = db.prepare(`
      INSERT INTO assignments (id, user_id, source_uid, recurrence_id, title, due_at, source_timezone, source_date, date_only, last_seen_marker)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, source_uid, recurrence_id) DO UPDATE SET
        title = excluded.title, due_at = excluded.due_at, source_timezone = excluded.source_timezone,
        source_date = excluded.source_date, date_only = excluded.date_only, last_seen_marker = excluded.last_seen_marker,
        reminder_eligible = CASE WHEN assignments.due_at = excluded.due_at THEN assignments.reminder_eligible ELSE 0 END
    `);
    for (const event of events) {
      upsert.run(randomUUID(), userId, event.uid, event.recurrenceId, event.title, event.dueAt,
        event.sourceTimezone, event.sourceDate, event.dateOnly ? 1 : 0, syncMarker);
    }
    db.prepare('DELETE FROM assignments WHERE user_id = ? AND last_seen_marker <> ?').run(userId, syncMarker);
    db.prepare(`INSERT INTO canvas_connections (user_id, encrypted_url, last_synced_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET encrypted_url = excluded.encrypted_url, last_synced_at = excluded.last_synced_at`)
      .run(userId, encryptedUrl, syncedAt);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { importedCount: events.length, lastSyncedAt: syncedAt };
}
