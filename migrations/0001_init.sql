-- Supah Dupah schema. All money is integer cents. Shares are REAL.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash     TEXT NOT NULL,
  salt          TEXT NOT NULL,
  sent_by       TEXT NOT NULL DEFAULT '',
  hood          TEXT NOT NULL DEFAULT '',
  is_cop        TEXT NOT NULL DEFAULT 'no',
  balance_cents INTEGER NOT NULL DEFAULT 10000,
  is_sal        INTEGER NOT NULL DEFAULT 0,
  last_bailout  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- kind: 'lmsr' (resolved by Sal) or 'toss' (auto-resolved live dough toss round)
CREATE TABLE markets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  kind        TEXT NOT NULL DEFAULT 'lmsr',
  category    TEXT NOT NULL,
  title       TEXT NOT NULL,
  blurb       TEXT NOT NULL DEFAULT '',
  rules       TEXT NOT NULL DEFAULT '[]',   -- JSON [[label, text], ...]
  outcomes    TEXT NOT NULL,                -- JSON ["YES","NO"]
  q           TEXT NOT NULL,                -- JSON [shares outstanding per outcome]
  b           REAL NOT NULL DEFAULT 100,
  status      TEXT NOT NULL DEFAULT 'open', -- open | resolved
  winner      INTEGER,
  closes_at   INTEGER,                      -- ms epoch; trading stops after
  round_no    INTEGER,                      -- toss rounds only
  featured    INTEGER NOT NULL DEFAULT 0,
  volume_cents INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX markets_status ON markets(status, kind);
CREATE UNIQUE INDEX markets_round ON markets(round_no) WHERE round_no IS NOT NULL;

CREATE TABLE positions (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id  INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  outcome    INTEGER NOT NULL,
  shares     REAL NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, market_id, outcome)
);

CREATE TABLE trades (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id   INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  outcome     INTEGER NOT NULL,
  shares      REAL NOT NULL,        -- negative = sell
  cents       INTEGER NOT NULL,     -- positive = paid, negative = received
  prices      TEXT NOT NULL,        -- JSON prices after trade
  created_at  INTEGER NOT NULL
);
CREATE INDEX trades_market ON trades(market_id, created_at);
CREATE INDEX trades_recent ON trades(created_at);

CREATE TABLE comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id  INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_market ON comments(market_id, created_at);

-- Truck futures: long = pay price per box, get current price back on close.
-- short = pay (100 - price) per box, get (100 - current) back on close.
CREATE TABLE van_positions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  side         TEXT NOT NULL,       -- long | short
  boxes        INTEGER NOT NULL,
  entry_cents  INTEGER NOT NULL,
  opened_at    INTEGER NOT NULL,
  exit_cents   INTEGER,
  closed_at    INTEGER,
  pnl_cents    INTEGER
);
CREATE INDEX van_open ON van_positions(user_id, closed_at);

-- Payout ledger so the tab can show wins and losses.
CREATE TABLE ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,   -- payout | bailout | welcome | van
  cents      INTEGER NOT NULL,
  memo       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX ledger_user ON ledger(user_id, created_at);

ALTER TABLE users ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE markets ADD COLUMN result TEXT;  -- toss rounds: JSON summary once settled
ALTER TABLE markets ADD COLUMN q0 TEXT;      -- opening quantities, for the first chart point

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Inserting changes() here after a guarded UPDATE aborts the whole batch when
-- that UPDATE touched no rows. D1 batches are transactions, so this is our rollback.
CREATE TABLE txn_guard (ok INTEGER NOT NULL CHECK (ok = 1));
