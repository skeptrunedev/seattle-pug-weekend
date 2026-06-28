CREATE TABLE IF NOT EXISTS checks (
  id         TEXT PRIMARY KEY,
  checked    INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint   TEXT PRIMARY KEY,
  sub        TEXT NOT NULL,
  client_id  TEXT,
  created_at TEXT
);
