CREATE TABLE IF NOT EXISTS checks (
  id         TEXT PRIMARY KEY,
  checked    INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
