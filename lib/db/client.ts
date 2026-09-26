import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let database: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (database) return database;
  const path = process.env.DATABASE_PATH === ':memory:' ? ':memory:' : resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || './data/study.db');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
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
  `);
  database = db;
  return db;
}
