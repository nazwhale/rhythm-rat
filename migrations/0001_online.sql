CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
  rating REAL NOT NULL DEFAULT 1500, rd REAL NOT NULL DEFAULT 350 CHECK(rd > 0),
  volatility REAL NOT NULL DEFAULT 0.06 CHECK(volatility > 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0), created_at INTEGER NOT NULL
);
CREATE TABLE puzzles (
  id TEXT PRIMARY KEY, level_id TEXT NOT NULL,
  rating REAL NOT NULL, rd REAL NOT NULL DEFAULT 200 CHECK(rd > 0),
  volatility REAL NOT NULL DEFAULT 0.06 CHECK(volatility > 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0)
);
CREATE TABLE results (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  puzzle_id TEXT NOT NULL REFERENCES puzzles(id), won INTEGER NOT NULL CHECK(won IN (0,1)),
  accepted_at INTEGER NOT NULL
);
CREATE INDEX results_user_recent ON results(user_id, accepted_at DESC, id);
CREATE INDEX results_puzzle ON results(puzzle_id);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE TABLE login_codes (
  email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
  guesses INTEGER NOT NULL DEFAULT 0, resend_at INTEGER NOT NULL
);
