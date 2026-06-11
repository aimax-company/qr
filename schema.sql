CREATE TABLE IF NOT EXISTS qr_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_id TEXT NOT NULL,
  ip TEXT,
  country TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_logs_qr_id
  ON qr_logs(qr_id);

CREATE INDEX IF NOT EXISTS idx_qr_logs_created_at
  ON qr_logs(created_at);
