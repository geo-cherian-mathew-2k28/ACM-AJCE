CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked')),
  issued_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS certificates_user_idx
  ON certificates(user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS certificates_event_idx
  ON certificates(event_id, issued_at DESC);
