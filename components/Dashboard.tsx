'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Assignment = { id: string; title: string; dueAt: string; sourceDate: string | null; dateOnly: boolean; completed: boolean };
type EventResponse = { assignments: Assignment[]; lastSyncedAt: string | null; hasCanvasFeed: boolean };

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [events, setEvents] = useState<EventResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function loadEvents() {
    const response = await fetch('/api/assignments', { cache: 'no-store' });
    if (response.ok) setEvents(await response.json() as EventResponse);
  }

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' }).then((response) => {
      if (response.ok) { setSignedIn(true); return loadEvents(); }
    }).catch(() => setMessage('Could not check your session.'));
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>, action: 'login' | 'register') {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/auth/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(action === 'register' ? { inviteCode } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Sign in failed');
      setSignedIn(true);
      setPassword('');
      setInviteCode('');
      await loadEvents();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sign in failed'); }
    finally { setBusy(false); }
  }

  async function sync(event?: FormEvent<HTMLFormElement>, refresh = false) {
    event?.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/canvas/import', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refresh ? {} : { feedUrl }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Canvas sync failed');
      setFeedUrl('');
      await loadEvents();
      setMessage(`Synced ${result.importedCount} calendar events.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Canvas sync failed'); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSignedIn(false);
    setEvents(null);
    setMessage('');
  }

  return <main className="dashboard">
    <h1>Temple Study</h1>
    {!signedIn ? <section>
      <h2>Student sign in</h2>
      <form onSubmit={(event) => submitAuth(event, 'login')}>
        <label>Email <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button disabled={busy}>Sign in</button>
      </form>
      <details><summary>Create a pilot account</summary>
        <form onSubmit={(event) => submitAuth(event, 'register')}>
          <label>Email <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password (12 characters minimum) <input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label>Invite code <input type="password" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required /></label>
          <button disabled={busy}>Create account</button>
        </form>
      </details>
    </section> : <>
      <button type="button" onClick={logout}>Sign out</button>
      <section>
        <h2>Canvas calendar</h2>
        <form onSubmit={sync}>
          <label>Temple Canvas iCal feed URL
            <input type="url" value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)}
              placeholder="https://templeu.instructure.com/feeds/calendars/user_….ics"
              required autoComplete="off" />
          </label>
          <button disabled={busy}>{events?.hasCanvasFeed ? 'Replace feed' : 'Import feed'}</button>
        </form>
        {events?.hasCanvasFeed && <button type="button" disabled={busy} onClick={() => sync(undefined, true)}>Refresh saved feed</button>}
        {events?.lastSyncedAt && <p>Last synced: {new Date(events.lastSyncedAt).toLocaleString()}</p>}
      </section>
      <section><h2>Calendar events</h2>
        <p>Calendar events may include items that are not assignments. A calendar entry does not confirm submission.</p>
        {events?.assignments.length ? <ul>{events.assignments.map((assignment) => <li key={assignment.id}>
          {assignment.title} — {assignment.dateOnly ? assignment.sourceDate : new Date(assignment.dueAt).toLocaleString()}
        </li>)}</ul> : <p>No imported events yet.</p>}
      </section>
    </>}
    {message && <p role="status">{message}</p>}
  </main>;
}
