# Replayable-ratings rollout — 15 November 2026

Preview and production run model `current-1000` (Glicko-2, initial player rating 1000, unchanged immutable authored puzzle seeds). `legacy-1500` is retained for catch-up rollback.

Production's 24 results were copied in insertion order into the explicit sequence. All backed-up result IDs, participants, outcomes, timestamps and sequence values matched after migration. Replaying the legacy 1500 settings exactly matched every original user and puzzle rating, RD and volatility before cleanup. The 1000 model was then fully replayed and activated. The old identity-table rating/revision fields and result snapshot column have been removed in both environments.

Private SQL backups and the production source-fact snapshot are in gitignored `.backups/` with restricted permissions. Do not publish them: they contain account and authentication data.

Validation completed:

- Existing gameplay/music/Glicko reference checks; 17 actual Worker/D1 integration tests; frontend and Worker typechecks; production build and deployment dry run.
- Preview API checks with an isolated `ReplaySmokeRat` account and one completed loss: negative delta, both updated states, one graph point, duplicate retry without an extra result, profile refresh, username update, session renewal and leaderboard.
- Preview rollback of the 1500 model caught up that newer result, then the 1000 model was restored. Both policies validated after old-column cleanup.
- Production API checks before and after cleanup used a temporary administrative session against the existing account. No production game outcomes were added. All 24 completed outcomes appeared in the graph plus its 1000 baseline; the endpoint matched the current rating. Account/session renewal, username update, ratings, duplicate retry, refreshed graph and leaderboard passed. Temporary test sessions were revoked.
- Browser checks confirmed preview leaderboard rendering (including the pixel trophy and provisional rating), the signed-out profile prompt, and opening/cancelling the email login dialog. Authenticated graph data was checked through the deployed API; the full interactive email-to-gameplay browser flow was not rerun during this rollout.

Use the administrator commands and rollback procedure in [online-ratings.md](online-ratings.md) for future settings changes. Production and preview databases remain separate.

## UI and draw-scoring follow-up

The subsequent release adds waiting-screen note types, flute as the initial bite sound, a shared shell for route loading, pixel icons on all tabs, default Rated mode with login/score badges, and a public Puzzles tab. The homepage’s full rating panel is replaced by compact game-header/end-screen feedback; per-puzzle outcomes moved to the profile.

Second-bite passes now score a draw. Migration 0005 converts prior booleans to equivalent numeric scores without changing historical outcomes. The first-bite failure stays in a durable deferred outbox record while Second bite is active. Web Locks prevent another tab from saving it prematurely; finishing, leaving, refreshing or closing the owning tab resolves or recovers that record.

All existing checks and 21 Worker/D1 integration tests passed, including numeric draws, exact draw replay, duplicate handling, account-scoped retries, public puzzle privacy and run locks. Local browser checks confirmed the default mode/sound, note guide before Start, first-failure deferral with another tab open, exactly one loss after Second bite fails, refresh recovery, persistent shell navigation, profile outcome rows and the Puzzles route. Preview API checks saved one isolated draw and verified both subjects, graph/history, duplicate retry and public puzzle caches. Private production/preview backups were taken before the score migration.

Production follow-up verification passed: all 38 backed-up outcomes, dates and sequence values survived migration 0005 unchanged. Live profile outcomes, graph endpoints, account renewal, duplicate retries, leaderboard and public Puzzles caches passed the smoke check. No production game outcomes were added by testing.

## Login-based play and musical score previews

The next UI-only release removes mode preferences and the mode selector: signed-out play is unrated with a login prompt; signed-in play is always rated. Puzzle titles show an on-demand eight-bar VexFlow score on pointer hover or keyboard focus, with an enlarged dialog for click/tap. Rendering includes bars 1–8, rests, beams, dots and partial ties across systems. Local checks covered both login states, sign-in cancellation, focus previews and dialog close; deployed preview checks covered the lazy-loaded score and pointer-hover popup. All existing checks and 21 integration tests passed. The read-only difficulty audit is recorded in `puzzle-difficulty-audit.md`; no new puzzles or rating inputs were changed.
