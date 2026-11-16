CREATE TRIGGER immutable_model_settings BEFORE UPDATE OF settings ON rating_models
WHEN NEW.settings IS NOT OLD.settings
BEGIN SELECT RAISE(ABORT,'Rating model settings are immutable; create a new model'); END;
CREATE TRIGGER immutable_puzzle_seed BEFORE UPDATE OF authored_seed ON puzzles
WHEN OLD.authored_seed IS NOT NULL AND NEW.authored_seed IS NOT OLD.authored_seed
BEGIN SELECT RAISE(ABORT,'Authored puzzle seeds are immutable'); END;
CREATE TRIGGER required_puzzle_seed BEFORE INSERT ON puzzles
WHEN NEW.authored_seed IS NULL
BEGIN SELECT RAISE(ABORT,'An authored puzzle seed is required'); END;
-- Previous Worker versions wrote this column. Block them during cutover so
-- their results cannot bypass the new model watermark.
CREATE TRIGGER legacy_rating_write_gate BEFORE INSERT ON results
WHEN NEW.player_rating_after IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Rated writes paused during rating-model cutover; retry shortly'); END;
