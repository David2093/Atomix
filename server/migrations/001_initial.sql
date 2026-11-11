PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar TEXT NOT NULL DEFAULT 'cyan',
  bio TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'midnight',
  notifications INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  item_key TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, kind, item_key)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, item_type, item_key)
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  accent TEXT NOT NULL DEFAULT 'cyan'
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  position INTEGER NOT NULL,
  quiz_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE(course_id, position)
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  read_minutes INTEGER NOT NULL DEFAULT 4,
  published_at TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'violet'
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at TEXT
);
