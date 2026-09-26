import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx
import icalendar
import recurring_ical_events

from app.security import decrypt_url, encrypt_url

MAX_FEED_BYTES = 2 * 1024 * 1024
MAX_EVENTS = 5000
CANVAS_PATH_RE = re.compile(r"^/feeds/calendars/user_[A-Za-z0-9_-]+\.ics$")
DISALLOWED_FREQ_RE = re.compile(r"\b(SECONDLY|MINUTELY|HOURLY)\b|\bBY(?:HOUR|MINUTE|SECOND)\b", re.IGNORECASE)


class CanvasImportError(Exception):
    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.message = message
        self.status = status


def validate_canvas_url(value: str) -> str:
    try:
        parsed = urlparse(value)
    except ValueError:
        raise CanvasImportError("Invalid Canvas feed URL", 400)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "templeu.instructure.com"
        or parsed.port
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or not CANVAS_PATH_RE.match(parsed.path)
    ):
        raise CanvasImportError("Use a Temple Canvas calendar feed URL", 400)
    return f"https://templeu.instructure.com{parsed.path}"


async def download_feed(url: str) -> str:
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=10.0) as client:
            async with client.stream("GET", url) as response:
                if response.status_code >= 400:
                    raise CanvasImportError("Canvas feed request failed", 502)
                declared_length = response.headers.get("content-length")
                if declared_length and int(declared_length) > MAX_FEED_BYTES:
                    raise CanvasImportError("Canvas feed is too large", 413)
                chunks: list[bytes] = []
                length = 0
                async for chunk in response.aiter_bytes():
                    length += len(chunk)
                    if length > MAX_FEED_BYTES:
                        raise CanvasImportError("Canvas feed is too large", 413)
                    chunks.append(chunk)
                return b"".join(chunks).decode("utf-8", errors="replace")
    except httpx.HTTPError:
        raise CanvasImportError("Could not download the Canvas feed", 502)


@dataclass
class CanvasEvent:
    uid: str
    recurrence_id: str
    title: str
    due_at: str
    source_timezone: str | None
    source_date: str | None
    date_only: bool


def _to_utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _tzid(dt_value) -> str | None:
    tzinfo = getattr(dt_value, "tzinfo", None)
    if tzinfo is None:
        return None
    name = getattr(tzinfo, "key", None) or str(tzinfo)
    return name or None


def parse_canvas_feed(body: str, now: datetime | None = None) -> list[CanvasEvent]:
    if not re.search(r"^BEGIN:VCALENDAR\s*$", body, re.MULTILINE) or not re.search(
        r"^END:VCALENDAR\s*$", body, re.MULTILINE
    ):
        raise CanvasImportError("Invalid iCalendar feed", 422)
    try:
        calendar = icalendar.Calendar.from_ical(body)
    except Exception:
        raise CanvasImportError("Invalid iCalendar feed", 422)

    now = now or datetime.now(timezone.utc)
    master_start_by_uid: dict[str, object] = {}
    for component in calendar.walk("VEVENT"):
        uid = str(component.get("UID", ""))
        if not uid:
            continue
        rrule = component.get("RRULE")
        if rrule is not None:
            master_start_by_uid[uid] = component.get("DTSTART").dt if component.get("DTSTART") else None
            if DISALLOWED_FREQ_RE.search(rrule.to_ical().decode("utf-8")):
                raise CanvasImportError("Recurring calendar event is too frequent", 422)

    window_start = now - timedelta(days=366)
    window_end = now + timedelta(days=366 * 2)
    try:
        occurrences = recurring_ical_events.of(calendar, keep_recurrence_attributes=True).between(
            window_start, window_end
        )
    except Exception:
        raise CanvasImportError("Invalid recurring calendar event", 422)
    if len(occurrences) > MAX_EVENTS:
        raise CanvasImportError("Canvas feed has too many events", 413)

    events: dict[str, CanvasEvent] = {}
    for component in occurrences:
        if str(component.get("STATUS", "")).upper() == "CANCELLED":
            continue
        uid = str(component.get("UID", ""))
        dtstart = component.get("DTSTART")
        if not uid or dtstart is None:
            continue
        start = dtstart.dt
        date_only = isinstance(start, date) and not isinstance(start, datetime)

        recurrence_prop = component.get("RECURRENCE-ID")
        if recurrence_prop is not None:
            recurrence_dt = recurrence_prop.dt
            recurrence_id = recurrence_dt.isoformat() if isinstance(recurrence_dt, datetime) else str(recurrence_dt)
        else:
            master_start = master_start_by_uid.get(uid)
            recurrence_id = "" if master_start is None or start == master_start else (
                start.isoformat() if isinstance(start, datetime) else str(start)
            )

        title = str(component.get("SUMMARY", "") or "Untitled event")[:500]
        if date_only:
            due_at = datetime(start.year, start.month, start.day, tzinfo=timezone.utc).isoformat().replace(
                "+00:00", "Z"
            )
            source_date = start.isoformat()
            source_timezone = None
        else:
            due_at = _to_utc_iso(start)
            source_date = None
            source_timezone = _tzid(start)

        key = f"{uid}\0{recurrence_id}"
        events[key] = CanvasEvent(
            uid=uid, recurrence_id=recurrence_id, title=title, due_at=due_at,
            source_timezone=source_timezone, source_date=source_date, date_only=date_only,
        )
        if len(events) > MAX_EVENTS:
            raise CanvasImportError("Canvas feed has too many events", 413)

    return list(events.values())


async def import_canvas_feed(db: sqlite3.Connection, user_id: str, supplied_url: str | None) -> dict:
    connection_row = db.execute(
        "SELECT encrypted_url FROM canvas_connections WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not supplied_url and not connection_row:
        raise CanvasImportError("Add a Canvas feed before refreshing", 400)

    url = validate_canvas_url(supplied_url or decrypt_url(connection_row["encrypted_url"]))
    body = await download_feed(url)
    events = parse_canvas_feed(body)

    synced_at = datetime.now(timezone.utc).isoformat()
    sync_marker = str(uuid.uuid4())
    encrypted_url = encrypt_url(url) if supplied_url else connection_row["encrypted_url"]

    db.execute("BEGIN IMMEDIATE")
    try:
        for event in events:
            db.execute(
                """
                INSERT INTO assignments (id, user_id, source_uid, recurrence_id, title, due_at,
                    source_timezone, source_date, date_only, last_seen_marker)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, source_uid, recurrence_id) DO UPDATE SET
                    title = excluded.title, due_at = excluded.due_at, source_timezone = excluded.source_timezone,
                    source_date = excluded.source_date, date_only = excluded.date_only,
                    last_seen_marker = excluded.last_seen_marker,
                    reminder_eligible = CASE WHEN assignments.due_at = excluded.due_at
                        THEN assignments.reminder_eligible ELSE 0 END
                """,
                (
                    str(uuid.uuid4()), user_id, event.uid, event.recurrence_id, event.title, event.due_at,
                    event.source_timezone, event.source_date, 1 if event.date_only else 0, sync_marker,
                ),
            )
        db.execute(
            "DELETE FROM assignments WHERE user_id = ? AND last_seen_marker <> ?", (user_id, sync_marker)
        )
        db.execute(
            """
            INSERT INTO canvas_connections (user_id, encrypted_url, last_synced_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET encrypted_url = excluded.encrypted_url,
                last_synced_at = excluded.last_synced_at
            """,
            (user_id, encrypted_url, synced_at),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"imported_count": len(events), "last_synced_at": synced_at}
