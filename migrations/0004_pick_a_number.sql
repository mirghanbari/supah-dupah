-- Pick A Number: you pick 1-10 and Tony's number is 1-10, but only 1 play in 100 wins. A hit pays 100x.
CREATE TABLE picks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pick         INTEGER NOT NULL,
  draw         INTEGER NOT NULL,
  bet_cents    INTEGER NOT NULL,
  payout_cents INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX picks_recent ON picks(created_at);
CREATE INDEX picks_user ON picks(user_id, created_at);
