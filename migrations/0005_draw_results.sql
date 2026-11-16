-- A result stores one numeric score, including a draw. Existing facts retain
-- exactly their original meaning; old browser clients can still send won.
ALTER TABLE results ADD COLUMN score REAL NOT NULL DEFAULT 0 CHECK(score IN (0,0.5,1));
UPDATE results SET score=won;
ALTER TABLE results DROP COLUMN won;
