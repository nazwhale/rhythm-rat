-- Rating snapshots are written atomically with each future result.
ALTER TABLE results ADD COLUMN player_rating_after REAL;
ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE;

-- Assign existing accounts two words too; the suffix guarantees uniqueness.
UPDATE users SET username =
  json_extract('["Rat","Mouse","Whisker","Tail","Paw","Snout","Nibble","Squeak","Scurry","Scamper","Cheese","Cheddar","Gouda","Edam","Brie","Swiss","Crumb","Cracker","Biscuit","Oat","Barley","Rye","Millet","Seed","Peanut","Walnut","Hazelnut","Almond","Acorn","Berry","Apple","Pear","Peach","Plum","Cherry","Grape","Raisin","Fig","Date","Melon","Pantry","Cupboard","Burrow","Tunnel","Nest","Nook","Attic","Cellar","Garden","Hedge","Meadow","Willow","Clover","Moss","Fern","Bramble","Thistle","Daisy","Poppy","Bamboo","Velvet","Fuzzy","Fluffy","Silky","Scruffy","Tiny","Little","Pocket","Mini","Cozy","Swift","Nimble","Sneaky","Curious","Clever","Brave","Merry","Sleepy","Bouncy","Zippy","Pitter","Patter","Tiptoe","Twitch","Wiggle","Wobble","Shuffle","Dart","Dash","Hop","Moon","Dusk","Midnight","Shadow","Lantern","Spark","Pebble","Button","Thimble","Treasure"]', '$[' || (rowid % 100) || ']') ||
  json_extract('["Rat","Mouse","Whisker","Tail","Paw","Snout","Nibble","Squeak","Scurry","Scamper","Cheese","Cheddar","Gouda","Edam","Brie","Swiss","Crumb","Cracker","Biscuit","Oat","Barley","Rye","Millet","Seed","Peanut","Walnut","Hazelnut","Almond","Acorn","Berry","Apple","Pear","Peach","Plum","Cherry","Grape","Raisin","Fig","Date","Melon","Pantry","Cupboard","Burrow","Tunnel","Nest","Nook","Attic","Cellar","Garden","Hedge","Meadow","Willow","Clover","Moss","Fern","Bramble","Thistle","Daisy","Poppy","Bamboo","Velvet","Fuzzy","Fluffy","Silky","Scruffy","Tiny","Little","Pocket","Mini","Cozy","Swift","Nimble","Sneaky","Curious","Clever","Brave","Merry","Sleepy","Bouncy","Zippy","Pitter","Patter","Tiptoe","Twitch","Wiggle","Wobble","Shuffle","Dart","Dash","Hop","Moon","Dusk","Midnight","Shadow","Lantern","Spark","Pebble","Button","Thimble","Treasure"]', '$[' || ((rowid + 37) % 100) || ']') || rowid;
CREATE UNIQUE INDEX users_username ON users(username COLLATE NOCASE);

-- Only the latest historical value is known. Preserve it without inventing a curve.
UPDATE results SET player_rating_after = (SELECT rating FROM users WHERE users.id=results.user_id)
WHERE rowid = (SELECT r.rowid FROM results r WHERE r.user_id=results.user_id ORDER BY r.accepted_at DESC,r.rowid DESC LIMIT 1);
