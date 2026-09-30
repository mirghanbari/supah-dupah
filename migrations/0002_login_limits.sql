-- Failed sign-in counters, per username and per IP, over a rolling 15-minute window.
CREATE TABLE login_attempts (
  key          TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
