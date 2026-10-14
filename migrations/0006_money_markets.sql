-- Money markets: daily bets on real closing prices (stocks, funds, crypto, oil), alongside the weather.

-- Which kind of batch a run was.
ALTER TABLE fresh_runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'weather'; -- 'weather' | 'money'

-- Price data, kept so the free Alpha Vantage key (25 calls a day) isn't spent twice on the same thing.
CREATE TABLE price_cache (
  symbol     TEXT PRIMARY KEY,
  fetched_at INTEGER NOT NULL,
  data       TEXT NOT NULL -- JSON {"YYYY-MM-DD": close, ...}, newest first
);
