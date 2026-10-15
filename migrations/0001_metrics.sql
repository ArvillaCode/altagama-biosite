CREATE TABLE IF NOT EXISTS metric_counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  source TEXT NOT NULL,
  device TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
  total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, source, device, is_test)
) WITHOUT ROWID;
