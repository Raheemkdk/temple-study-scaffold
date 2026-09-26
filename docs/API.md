# API and data handoff

The Canvas import, basic pilot authentication, and assignment listing routes are implemented. Other routes remain planned stubs.

All endpoints are same-origin JSON over HTTPS, scoped to the authenticated student's account unless noted. Implemented state-changing routes check the request origin and validate inputs. Failures return `{ "error": "..." }` with an appropriate HTTP status. Canvas URLs and server keys are never returned to the browser. The server resolves student identity from the session cookie; request bodies do not accept a `userId`.

| Endpoint | Input | Proposed response | Owner |
| --- | --- | --- | --- |
| `POST /api/auth/register` | email, password, invite code | student summary; HTTP-only session cookie | 2 |
| `POST /api/auth/login` | email, password | student summary; session cookie | 2 |
| `POST /api/auth/logout` | empty | `{ok:true}` | 2 |
| `GET /api/auth/me` | none | student summary or unauthenticated state | 2 |
| `POST /api/canvas/import` | `{ "feedUrl": "https://templeu.instructure.com/feeds/calendars/user_….ics" }` for import/replacement, or `{}` to refresh the saved feed | `{ "importedCount": number, "lastSyncedAt": ISO string }` | 3 |
| `GET /api/assignments` | none | events with ID, title, UTC due time, local completion, source type | 2 + 3 |
| `PATCH /api/assignments/{id}` | completed boolean; optionally reminder eligibility | updated event summary | 2 + 4 |
| `POST /api/grades/scenario` | target %, earned weighted points, remaining weight % | required average %, feasibility and assumptions | 2 |
| `POST /api/study/plan` | event ID, difficult topic, minutes | short task, model/template source | 3 |
| `GET /api/push/subscribe` | none | public VAPID key | 4 |
| `POST /api/push/subscribe` | browser subscription JSON | `{ok:true}` | 4 |
| `POST /api/reminders/test` | empty | accepted/failed result for own device | 4 |

The implemented Canvas slice initializes `users`, `sessions`, `canvas_connections`, and `assignments` in SQLite. Imports are unique by `(user_id, source_uid, recurrence_id)`, with due instants stored as UTC ISO strings and date-only values preserved separately. The database enables foreign keys, WAL, and a busy timeout. Feed URLs are encrypted at rest. Versioned migrations, backups, reminder jobs, and the other planned tables remain future work.

Before extending the remaining routes, owners 1–4 should agree on event DTO, reminder eligibility (calendar contains non-assignment events), grade units, failure codes, and schema migration order.
