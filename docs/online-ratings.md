# Online ratings

One Cloudflare Worker serves the Vite frontend and same-origin API. One D1 database stores identities, permanent results, model definitions and rebuildable rating caches. The existing private `worker-email` sends four-digit codes over RPC.

## Data and rating rules

- `users`: identity, email, unique case-insensitive username, account creation time.
- `puzzles`: content-version ID, authored level ID and immutable authored seed. Initial puzzle rating is seed + model offset (500). Titles and notation remain in the code catalog. Renaming or changing the catalog seed never updates an existing version's seed. Changed gameplay content gets a new SHA-256 identity; old versions remain usable by pending submissions.
- `results`: explicit AUTOINCREMENT `seq`, unique submission UUID, user/puzzle IDs, numeric score (win 1, draw ½, loss 0), server acceptance date. Sequence is the replay order; dates only position graph points. Migration 0003 copies the original rowid into the explicit sequence before replacing the table.
- `rating_models`: immutable versioned settings, active flag, pause/status flags, processing watermark. Previous models stay available for rollback.
- `rating_state`: current rating/RD/volatility cache per model and subject. Exactly one user or puzzle FK must be present; each subject is unique within a model.
- `rating_history`: disposable post-result player ratings keyed by model/result sequence, indexed by model/user.
- `sessions` and `login_codes`: authentication, unchanged by model rebuilds.

The active model starts players at **1000 / 350 / 0.06** and puzzles at **authored seed + 500 / 200 / 0.06**. Tau is 0.5, each completed rated challenge is a period, and no calendar decay runs. The algorithm's internal 1500 coordinate center is separate from the configurable player starting rating. All calculations retain floating-point precision; UI values are rounded. Counts, wins, win rate, rank, provisional status and pass probabilities are derived.

Regular rated recommendations have a 30% chance of choosing a puzzle rated above the player, aiming for 45–49% expected score. Other selections favour puzzles at or below the player's rating, aiming for 65–75% expected score. If a difficulty group is empty, the game uses the available group. Within the selected group it prefers puzzles outside the last three rated results and uses the closest match when none are in the target band. Note filters still apply. After a final loss the game uses the practice target and prefers puzzles rated below the failed puzzle. First-bite passes score 1. After a first-bite failure, a second-bite pass scores ½ and a second-bite failure scores 0. Leaving after that first failure saves a loss; leaving before a first-bite result and unrated games submit nothing. A draw uses Glicko-2’s normal half score and can still gain or lose rating relative to puzzle difficulty.

## Transactions and API

Each accepted result uses both pre-result snapshots. A D1 batch guards the active, unpaused model watermark with a NOT NULL constraint, inserts the fact, updates both caches, inserts the graph point and advances the watermark to the assigned result sequence. A stale watermark rolls everything back; the Worker rereads and retries up to three times, then returns 503. This deliberately serializes rating commits globally for this small game. Reads use indexed caches and never replay global history in a request.

Duplicate submission UUIDs succeed for the same owner and payload without extra results/history. Conflicting reuse returns 409. A duplicate has no delta; successful first submissions include authoritative updated player/puzzle states. Rating responses include `ratingModelId`; profiles also include `initialRating`. Batched reads use one active model consistently, including counts through that model's watermark.

Completed results stay in the account/run-keyed browser outbox until acknowledged. A first-bite failure is retained there as a deferred loss while Second bite remains active. A per-run Web Lock prevents other tabs from sending that deferred result; the owner finalizes it as win/draw/loss, or releases it as a loss when leaving. Refresh/tab closure releases the lock automatically so a returning tab can save the retained loss. Rated play requires Web Locks (current mainstream browsers); unrated play remains available without them. Legacy boolean outbox records and API payloads are still accepted as 1/0 scores. On pause, network error or expired session, they remain queued and retry on focus, reconnect, every 30 seconds while visible, or Retry. After account expiry they resume when the same account signs in. A failed browser-storage write is retained in memory while the tab remains open.

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars
npm run build
npm run db:local
npm run ratings:admin -- create --local --id local-1000
npm run ratings:admin -- rebuild --local --id local-1000
npm run ratings:admin -- validate --local --id local-1000
npm run ratings:admin -- activate --local --id local-1000
npm run ratings:admin -- cleanup --local
npm run dev:worker
```

Open http://localhost:8787. `LOCAL_EMAIL=true` prints codes only in the local terminal. For frontend hot reload also run `npm run dev` (Vite proxies API requests to 8787). Repeated setup uses the existing active model; do not recreate its ID or rerun cleanup after the columns have already been removed.

## Administrator rebuilds and rollback

The CLI uses Wrangler's authenticated D1 access, not a public administrative endpoint, extra service or background job. Default environment is production; append `--preview` for preview or `--local` for local D1. Do not run two administrators concurrently. Replay checkpoints contain all changed states, history and the watermark in one transactional SQL API batch ([Cloudflare SQL API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/), [transaction semantics](https://developers.cloudflare.com/d1/observability/find-expensive-queries/)). Interrupted commands can safely be rerun.

```sh
# Default policy is 1000; --initial overrides only that setting.
# --settings policy.json accepts a full supported settings definition instead.
npm run ratings:admin -- create --preview --id rules-v2 --initial 1000
npm run ratings:admin -- rebuild --preview --id rules-v2
npm run ratings:admin -- validate --preview --id rules-v2
npm run ratings:admin -- activate --preview --id rules-v2
npm run ratings:admin -- status --preview
```

Creation pauses rated writes. Existing profiles/leaderboards continue using the previous consistent model. The replay reads 25 facts per page and checkpoints progress. `--pages 1` stops after one page for a planned interruption; `rebuild` resumes at the persisted watermark. Completeness, graph endpoints, subject coverage and participants are checked before atomic activation; activation also rechecks the head and write gate inside its transaction. A validation/command failure leaves writes paused, allowing diagnosis and safe resume.

For rollback, run `rollback --id PREVIOUS_MODEL`, then `validate` and `activate` with that ID. Rollback first pauses writes and catches up the previous policy through all newly accepted results; flipping a stale model directly is forbidden. To abandon a candidate and restore the current policy, create another candidate with the current settings and rebuild/activate it. Settings and original puzzle seeds cannot be edited in place (database triggers enforce this).

Changing the initial rating, tau or seeds' global offset recomputes all states and all graph points without modifying source results or original puzzle seeds. An algorithm change requires a new supported algorithm implementation/version; do not reinterpret the existing `glicko2-v1` definition. Profiles label graphs as calculated under current rules. Every completed historical result is replayed, so no history-gap notice is necessary.

## First deployment / cutover

Production and preview use separate databases in `wrangler.jsonc`. Each has its own `AUTH_SECRET` secret and a binding to the existing `worker-email`. Never deploy `LOCAL_EMAIL=true`.

Back up **preview first**, then migrate/deploy preview. Run these steps on preview and verify them before repeating on production (omit `--preview`; Wrangler environment becomes `--env ''`):

```sh
npx wrangler d1 export DB --remote --env preview --output /private/tmp/rhythm-preview-before-replay.sql
npm run deploy:preview
npm run ratings:admin -- create --preview --id legacy-1500 --initial 1500
npm run ratings:admin -- rebuild --preview --id legacy-1500
npm run ratings:admin -- validate --preview --id legacy-1500 --legacy
npm run ratings:admin -- activate --preview --id legacy-1500
npm run ratings:admin -- create --preview --id current-1000
npm run ratings:admin -- rebuild --preview --id current-1000
npm run ratings:admin -- validate --preview --id current-1000
npm run ratings:admin -- activate --preview --id current-1000
# Verify API/profile/leaderboard before removing old columns.
npm run ratings:admin -- cleanup --preview
```

Migration 0003 is additive for old rating columns. Migration 0004 blocks result inserts from the old Worker (identified by its non-null legacy snapshot), preventing old code from bypassing the watermark during cutover. The new Worker returns a retryable 503 until a model is activated. Login and unrated play continue. Catalog initialization fills missing immutable seeds once; an archived version missing from the catalog must have its original seed supplied explicitly before replay can proceed.

`--legacy` validates every played user's and puzzle's rating, RD and volatility against the old operational cache with exact equality before cleanup. Existing never-played puzzle ratings are their stored original catalog seeds. `cleanup` only runs after validating an active unpaused model; it removes the obsolete rating/revision fields and legacy result snapshot. Keep the backup private: it includes email addresses and authentication records. Subsequent deploys initialize new puzzle versions and preserve active settings/state; they do not implicitly rebuild or reset ratings.

## Accounts and public pages

Login requires a four-digit HMAC-hashed email code (10-minute expiry, five guesses, 60-second resend cooldown, replacement on resend, single use). Emails put the selectable code first in the subject, in large bold HTML, and on its own plaintext line. Sessions use random 256-bit tokens, hashed in D1, with year-long HttpOnly/Secure/SameSite cookies renewed on return. Logout revokes that session.

New accounts receive two distinct words from a 100-word rat-themed list. `/profile` supports username edits and a graph of the active rules' complete history. `/leaderboard` is public, shows usernames/ratings/uncertainty/run counts, and paginates 50 players sorted by rating, run count and username. Pixel trophies mark the leaders. Public responses exclude emails and private history.

## Verification

`npm test` retains the published Glicko-2 example and gameplay/music checks. Disposable Miniflare D1 integration tests cover authentication, names/privacy/pagination, concurrent results, duplicates, failed transactional rollback, complete replay versus incremental updates, equal timestamps with explicit ordering, interrupted checkpoint/resume, failed premature activation, queued submission retries, policy changes, catch-up rollback and immutable inputs. `npm run build` typechecks both frontend and Worker.

Before production, check preview login → rated first bite → Saved → profile/leaderboard → refresh, including zero-game profiles. Confirm a first-bite win counts, a second-bite pass is a draw, a second-bite failure or leaving after first failure is a loss, and abandonment before a result does not count, username edits still work, graph endpoints equal current ratings and the baseline is 1000. API checks complement browser checks; report unavailable browser verification explicitly.

The [15 November 2026 rollout record](replay-rollout.md) records the deployed validation and browser-check scope. `npm run smoke:ratings -- --preview` and `npm run smoke:ratings` repeat the deployed API checks; `--write-preview` creates a preview-only test outcome. The smoke command uses and revokes a temporary administrative session, so it requires Wrangler access.

The shared React shell preserves branding/navigation during route changes and keeps loading indicators inside page content. The waiting screen includes the note-type guide, bite audio defaults to flute, navigation tabs have pixel icons, and signed-out play is unrated with a small login prompt. Signed-in play is always rated, with no mode selector or stored mode preference.

## Draw-score and homepage follow-up

Migration 0005 replaces the boolean `won` source field with `score` (0, ½, 1), preserving all old outcomes, IDs, sequences and acceptance dates. Old API clients can still send `{ won }`; the current client sends `{ score, userId }`, which also protects account-scoped outbox results when a different account signs into another tab. Existing results remain wins/losses: no unrecorded historical second-bite outcomes are inferred. Both incremental processing and full replay use the same numeric-score Glicko-2 engine.

The homepage shows compact rating/save feedback in the game header, with loss feedback repeated in the end screen. Personal outcomes are in the profile’s newest-first challenge history (20 rows at a time). `/puzzles` and public `GET /api/puzzles` show the current catalog’s shared difficulties without exposing account data. The profile listens for a finished pending save so navigating away from Second bite does not leave its history stale.

Puzzle titles now preview an engraved eight-bar score on hover or keyboard focus. Click/tap opens an accessible dialog; narrow screens wrap the score into fewer bars per line. The score renderer loads on demand and includes rests, dotted notes, beams and ties across bar/system boundaries. Difficulty-coverage recommendations based on the first two players are in [puzzle-difficulty-audit.md](puzzle-difficulty-audit.md).
