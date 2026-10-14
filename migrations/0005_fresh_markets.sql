-- Fresh markets: daily bets on real weather, written by Claude (or the house templates)
-- and settled automatically from Open-Meteo.

-- JSON settlement spec for auto-settled markets: {spot, metric, date, threshold, lat, lon, settleAfter}
ALTER TABLE markets ADD COLUMN auto TEXT;
CREATE INDEX markets_auto ON markets(status) WHERE auto IS NOT NULL;

-- One row per batch, so Tony can see what the writer did and what it cost.
CREATE TABLE fresh_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    INTEGER NOT NULL,
  for_date      TEXT NOT NULL,              -- the day the bets are about
  trigger       TEXT NOT NULL,              -- 'daily' | 'tony'
  writer        TEXT NOT NULL,              -- model id, or 'house'
  made          INTEGER NOT NULL DEFAULT 0, -- markets opened
  from_writer   INTEGER NOT NULL DEFAULT 0, -- of those, how many the writer wrote (rest are house fill-ins)
  rejected      TEXT NOT NULL DEFAULT '[]', -- JSON [why, ...] for picks that failed the checks
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micros   INTEGER NOT NULL DEFAULT 0, -- millionths of a dollar
  error         TEXT
);
CREATE INDEX fresh_runs_recent ON fresh_runs(created_at);
