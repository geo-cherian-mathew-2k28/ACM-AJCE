ALTER TABLE events ADD COLUMN poster_url TEXT;
ALTER TABLE events ADD COLUMN event_url TEXT;
ALTER TABLE events ADD COLUMN whatsapp_url TEXT;
ALTER TABLE events ADD COLUMN after_registration_content TEXT;

CREATE TABLE IF NOT EXISTS chapter_fund_entries (
  id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  title TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  recorded_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS chapter_fund_entries_recorded_idx
  ON chapter_fund_entries(recorded_at DESC);
