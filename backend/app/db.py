import sqlite3
import threading
from pathlib import Path

from app.config import get_settings

_lock = threading.Lock()
_connection: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS canvas_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_url TEXT NOT NULL,
  last_synced_at TEXT
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_uid TEXT NOT NULL,
  recurrence_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  due_at TEXT NOT NULL,
  source_timezone TEXT,
  source_date TEXT,
  date_only INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  reminder_eligible INTEGER NOT NULL DEFAULT 0,
  last_seen_marker TEXT NOT NULL,
  UNIQUE(user_id, source_uid, recurrence_id)
);
CREATE INDEX IF NOT EXISTS assignments_user_due ON assignments(user_id, due_at);
"""


def get_db() -> sqlite3.Connection:
    """Return a process-wide SQLite connection, creating and migrating it on first use.

    A single connection guarded by a lock mirrors the simplicity of the original
    Node `getDb()` singleton -- this app is a small pilot, not a high-concurrency
    service. Do not run this file over a shared network filesystem.
    """
    global _connection
    if _connection is not None:
        return _connection
    with _lock:
        if _connection is not None:
            return _connection
        settings = get_settings()
        path = settings.database_path
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.executescript(SCHEMA)
        connection.commit()
        _connection = connection
        return _connection


def db_lock() -> threading.Lock:
    """Serialize writes across requests, since sqlite3 connections aren't safe
    for concurrent use from multiple threads even with check_same_thread=False."""
    return _lock
