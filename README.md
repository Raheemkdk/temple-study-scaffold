# Nemo.AI

Refactor of the original `temple-study-scaffold` (Next.js full-stack) into a
Python **FastAPI** backend and a **TypeScript** (Vite + React) frontend,
connected over REST + a WebSocket. The product scope is unchanged from the
original README — this is a structural/stack refactor, not a feature change,
except for the study-task route, which now streams from **Google Gemini**
token-by-token instead of being a stub.

```
nemo-ai/
  backend/     FastAPI app, SQLite, Canvas import, auth, Gemini WebSocket
  frontend/    Vite + React + TypeScript SPA
```

## What moved where

| Original | New |
| --- | --- |
| `app/api/auth/*` | `backend/app/routers/auth.py` |
| `app/api/canvas/import` | `backend/app/routers/canvas.py` + `backend/app/canvas_ics.py` |
| `app/api/grades/scenario` | `backend/app/routers/grades.py` |
| `app/api/assignments/*` | `backend/app/routers/assignments.py` |
| `app/api/study/plan` (stub) | `backend/app/routers/study.py` — now a **WebSocket** (`/ws/study-plan`) streaming from Gemini, see below |
| `lib/auth`, `lib/db`, `lib/canvas` | `backend/app/security.py`, `db.py`, `canvas_ics.py` |
| `components/Dashboard.tsx` | `frontend/src/components/Dashboard.tsx` (same behavior, calls the FastAPI backend) |
| — | `frontend/src/components/StudyPlan.tsx` — new UI for the Gemini feature |
| `app/api/push/*`, `app/api/reminders/*`, `lib/reminders`, `worker/` | **Not ported.** These were stubs/TODOs in the original (owner 4's slice) and stayed out of scope here. `backend/app/routers/push.py` and `reminders.py` keep the same `501 Not Implemented` stubs so the contract in `docs/API.md` still holds. |

Everything ported was tested end-to-end while building this (register →
login → session cookie → grade scenario → assignments list → origin
rejection; Canvas ICS parsing including recurrence expansion, all-day
events, and the cancelled/too-frequent guards; the WebSocket auth and
template-fallback path).

## Why a WebSocket for the study task

The original spec (`docs/AI_AND_HABITS.md`) called for one bounded AI
request per study session with a deterministic template fallback. That's
still true here — the WebSocket sends **one response per connection**, just
streamed token-by-token instead of returned as one JSON blob, so the student
sees the task appear as it's generated rather than waiting on a spinner.
Same constraints as before: small input (assignment title + difficult topic
+ minutes only, no name/email/full feed/grades), hard output-token cap,
timeout, and a labeled template fallback if the model is slow, errors, or
`GEMINI_API_KEY` isn't set.

## Running it locally

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in APP_ENCRYPTION_KEY and PILOT_INVITE_CODE at minimum
uvicorn app.main:app --reload --port 8000
```
Generate `APP_ENCRYPTION_KEY` with:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env.local   # defaults already point at localhost:8000
npm run dev
```
Open `http://localhost:5173`.

## Auth cookie across origins

The frontend and backend are now separate origins (ports 5173 and 8000), so
session cookies need `credentials: 'include'` on every request (already set
in `frontend/src/api/client.ts`) and CORS on the backend must name the exact
frontend origin — `ALLOWED_ORIGINS` in `backend/.env` (wildcard `*` won't
work with credentialed requests). In dev, `SameSite=Lax` is enough since
both are `localhost`. In production, if the frontend and backend are on
different domains, set `COOKIE_SECURE=true` so the backend switches to
`SameSite=None; Secure`, and serve both over HTTPS.

## Testing

- Backend: `cd backend && python -m pytest` (add tests under `backend/tests/`
  — none are included yet; the original repo's `tests/integration/canvas-import.test.ts`
  was TypeScript and wasn't ported).
- Frontend: `cd frontend && npm run typecheck && npm run build`.

## Not done here (carried over as TODOs from the original)

- Push notifications (`VAPID_*`, `/api/push/subscribe`)
- The 48/24-hour reminder scheduler and worker
- `PATCH /api/assignments/{id}` (needs the reminders piece to cancel jobs on completion)

These were unfinished in the original repo too (owner 4's slice) — porting
their *stub* status was the goal here, not implementing them.
