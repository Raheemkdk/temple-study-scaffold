import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getDb } from '../../lib/db/client';
import { importCanvasFeed, parseCanvasFeed, validateCanvasUrl } from '../../lib/canvas/import';
import { startSession } from '../../lib/auth/sessions';
import { POST as importRoute } from '../../app/api/canvas/import/route';

const feedUrl = 'https://templeu.instructure.com/feeds/calendars/user_synthetic-token.ics';
const event = (due: string, title = 'Essay due') => `BEGIN:VEVENT\r\nUID:canvas-essay\r\nDTSTAMP:20260926T120000Z\r\nDTSTART${due.length === 8 ? ';VALUE=DATE' : ''}:${due}\r\nSUMMARY:${title}\r\nEND:VEVENT`;
const calendar = (items: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${items.join('\r\n')}\r\nEND:VCALENDAR\r\n`;

before(() => {
  process.env.DATABASE_PATH = ':memory:';
  process.env.APP_ENCRYPTION_KEY = '11'.repeat(32);
  const db = getDb();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run('student-a', 'a@example.test', 'unused', new Date().toISOString());
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run('student-b', 'b@example.test', 'unused', new Date().toISOString());
});

test('validates only exact Temple Canvas feed URLs', () => {
  assert.equal(validateCanvasUrl(feedUrl), feedUrl);
  for (const url of [
    'http://templeu.instructure.com/feeds/calendars/user_token.ics',
    'https://templeu.instructure.com.evil.test/feeds/calendars/user_token.ics',
    'https://templeu.instructure.com/feeds/calendars/user_token.ics?x=1',
  ]) assert.throws(() => validateCanvasUrl(url));
});

test('parses date-only events separately from timed events', () => {
  const events = parseCanvasFeed(calendar([event('20261003', 'Reading day')]));
  assert.equal(events.length, 1);
  assert.equal(events[0].dateOnly, true);
  assert.equal(events[0].sourceDate, '2026-10-03');
});

test('expands recurring events, exclusions, and moved instances', () => {
  const recurring = `BEGIN:VEVENT\r\nUID:weekly-lab\r\nDTSTAMP:20260926T120000Z\r\nDTSTART:20261001T150000Z\r\nDTEND:20261001T160000Z\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE:20261008T150000Z\r\nSUMMARY:Lab\r\nEND:VEVENT`;
  const moved = `BEGIN:VEVENT\r\nUID:weekly-lab\r\nDTSTAMP:20260926T120000Z\r\nRECURRENCE-ID:20261015T150000Z\r\nDTSTART:20261016T180000Z\r\nSUMMARY:Moved lab\r\nEND:VEVENT`;
  const events = parseCanvasFeed(calendar([recurring, moved]), new Date('2026-09-26T00:00:00Z'));
  assert.deepEqual(events.map(({ recurrenceId, dueAt }) => ({ recurrenceId, dueAt })), [
    { recurrenceId: '', dueAt: '2026-10-01T15:00:00.000Z' },
    { recurrenceId: '2026-10-15T15:00:00.000Z', dueAt: '2026-10-16T18:00:00.000Z' },
    { recurrenceId: '2026-10-22T15:00:00.000Z', dueAt: '2026-10-22T15:00:00.000Z' },
  ]);
});

test('rejects recurrence rules that would generate excessive instances', () => {
  const frequent = `BEGIN:VEVENT\r\nUID:frequent\r\nDTSTAMP:20260926T120000Z\r\nDTSTART:20261001T150000Z\r\nRRULE:FREQ=SECONDLY\r\nSUMMARY:Too frequent\r\nEND:VEVENT`;
  assert.throws(() => parseCanvasFeed(calendar([frequent]), new Date('2026-09-26T00:00:00Z')));
});

test('imports, refreshes without duplicates, updates deadlines, and keeps students separate', async () => {
  let body = calendar([event('20261003T150000Z')]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(body, { status: 200 });
  try {
    const first = await importCanvasFeed('student-a', feedUrl);
    assert.equal(first.importedCount, 1);
    const db = getDb();
    const saved = db.prepare('SELECT encrypted_url FROM canvas_connections WHERE user_id = ?').get('student-a') as { encrypted_url: string };
    assert.ok(!saved.encrypted_url.includes(feedUrl));
    await importCanvasFeed('student-a');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE user_id = ?').get('student-a')?.count, 1);
    body = calendar([event('20261004T150000Z')]);
    await importCanvasFeed('student-a');
    const changed = db.prepare('SELECT due_at FROM assignments WHERE user_id = ?').get('student-a') as { due_at: string };
    assert.equal(changed.due_at, '2026-10-04T15:00:00.000Z');
    body = 'invalid calendar';
    await assert.rejects(importCanvasFeed('student-a'));
    assert.equal((db.prepare('SELECT due_at FROM assignments WHERE user_id = ?').get('student-a') as { due_at: string }).due_at, changed.due_at);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE user_id = ?').get('student-b')?.count, 0);
    await assert.rejects(importCanvasFeed('student-b'));
    body = calendar([]);
    await importCanvasFeed('student-a');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE user_id = ?').get('student-a')?.count, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('POST with an empty body refreshes the signed-in student’s saved feed', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(calendar([event('20261005T150000Z')]), { status: 200 });
  };
  try {
    const url = 'http://localhost:3000/api/canvas/import';
    const sessionResponse = Response.json({ ok: true });
    startSession('student-a', new Request(url), sessionResponse);
    const cookie = sessionResponse.headers.get('set-cookie')!.split(';')[0];
    const request = (body: object, origin = 'http://localhost:3000') => new Request(url, {
      method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await importRoute(request({}))).status, 200);
    assert.equal(calls, 1);
    assert.equal((await importRoute(request({}, 'https://evil.test'))).status, 403);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
