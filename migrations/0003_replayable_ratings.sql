-- Additive cutover: old state columns stay until replay validation succeeds.
ALTER TABLE puzzles ADD COLUMN authored_seed REAL;
CREATE TABLE results_ordered (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  puzzle_id TEXT NOT NULL REFERENCES puzzles(id),
  won INTEGER NOT NULL CHECK(won IN (0,1)),
  accepted_at INTEGER NOT NULL,
  player_rating_after REAL
);
INSERT INTO results_ordered(seq,id,user_id,puzzle_id,won,accepted_at,player_rating_after)
SELECT rowid,id,user_id,puzzle_id,won,accepted_at,player_rating_after FROM results ORDER BY rowid;
DROP TABLE results;
ALTER TABLE results_ordered RENAME TO results;
CREATE INDEX results_user_recent ON results(user_id,seq DESC);
CREATE INDEX results_puzzle ON results(puzzle_id);
CREATE TABLE rating_models (
  id TEXT PRIMARY KEY,
  settings TEXT NOT NULL CHECK(json_valid(settings)),
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  paused INTEGER NOT NULL DEFAULT 1 CHECK(paused IN (0,1)),
  status TEXT NOT NULL DEFAULT 'building' CHECK(status IN ('building','ready')),
  watermark INTEGER NOT NULL DEFAULT 0 CHECK(watermark>=0),
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX one_active_model ON rating_models(active) WHERE active=1;
CREATE TABLE rating_state (
  model_id TEXT NOT NULL REFERENCES rating_models(id),
  user_id TEXT REFERENCES users(id),
  puzzle_id TEXT REFERENCES puzzles(id),
  rating REAL NOT NULL,
  rd REAL NOT NULL CHECK(rd>0),
  volatility REAL NOT NULL CHECK(volatility>0),
  CHECK((user_id IS NOT NULL)+(puzzle_id IS NOT NULL)=1)
);
CREATE UNIQUE INDEX rating_user ON rating_state(model_id,user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX rating_puzzle ON rating_state(model_id,puzzle_id) WHERE puzzle_id IS NOT NULL;
CREATE INDEX rating_leaderboard ON rating_state(model_id,rating DESC) WHERE user_id IS NOT NULL;
CREATE TABLE rating_history (
  model_id TEXT NOT NULL REFERENCES rating_models(id),
  result_seq INTEGER NOT NULL REFERENCES results(seq),
  user_id TEXT NOT NULL REFERENCES users(id),
  rating REAL NOT NULL,
  PRIMARY KEY(model_id,result_seq)
);
CREATE INDEX rating_history_user ON rating_history(model_id,user_id,result_seq);
