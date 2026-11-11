CREATE TABLE IF NOT EXISTS user_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS user_notifications_recent ON user_notifications(user_id,created_at DESC);
