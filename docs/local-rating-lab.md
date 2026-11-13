# Local rating experiment

Open **Rating experiment**, optionally set a player name, then choose **Find my next challenge** and start normally. First attempts rate both the player and the level. Second bite records a practice attempt under the same encounter without changing ratings. Wins suggest another challenge near a predicted 70% pass probability; after a final loss, suggestions are restricted to lower learned difficulties where available. The last three encounters are avoided where possible. The normal picker leaves rated mode and campaign/scenery order stays authored.

Ratings and history survive refresh in this browser on this origin. Naz and Bridget each have an independent dataset; their level difficulties are not shared. Private browsing, clearing site data, a different browser/device or a different deployment origin will have separate or missing history. Use one tab for the experiment: Web Locks prevent a second tab from rating or reconciling an in-progress run. Practice still works without storage or Web Locks. Export results before clearing data. Reset requires confirmation.

Leaving during count-in voids a run. Leaving or refreshing after gameplay should have begun counts as a first-attempt loss when the abandoned attempt is reconciled. An abandoned retry stays unrated. Closing the browser cannot synchronously persist its closing time; recovery uses the next visit's time. Inputs and outcomes are trusted for this personal test, not a competitive leaderboard. Repeated encounters with the same version are allowed with no cooldown. These correlated results can overstate confidence; inspect RD as an experimental indicator, not a certified skill interval.

## Rating policy

- Glicko-2 with tau 0.5; each first attempt is an online rating period.
- New player: 1500, RD 350, volatility 0.06.
- New level version: authored seed + 500, RD 200, volatility 0.06.
- Both updates use the opponent's pre-result snapshot.
- No wall-clock inactivity decay in this prototype.
- A question mark means RD > 110. Suggested pass chances are estimates, especially for provisional ratings.
- The published Glicko-2 worked example is a regression test; this is not Lichess's exact policy or configuration.

## Stored schema and later D1 mapping

One versioned JSON snapshot lives at `rhythm-rat:rating-lab:v1`. Writing a complete snapshot commits both sides of a match and its history together. A revision check provides an additional stale-write guard. Failed/quota-blocked writes stop the experiment and surface an error without breaking normal play. Incompatible or inconsistent snapshots are kept for raw export and explicit reset rather than silently overwritten.

| JSON collection | Future D1 table | Key/relationship |
| --- | --- | --- |
| `user` | `users` | Local UUID now; bind to authenticated identity later |
| `pool` | `rating_pools` | Rules/algorithm policy, tau |
| `levelVersions` | `level_versions` | Stable level ID + content hash; full rhythm content retained |
| `ratings` | `ratings` | Unique pool + subject type + subject ID; current rating/RD/volatility/games |
| `encounters` | `encounters` | User + level version + pool |
| `attempts` | `attempts` | Unique encounter + attempt number; outcome/timestamps/counts/reason |
| `ratingEvents` | `rating_events` | Unique encounter; first attempt + win/loss + algorithm |
| `ratingChanges` | `rating_changes` | Unique event + rating ID; before/after snapshots for both subjects |

Changes to rhythm/BPM/meter create a new local level version. Renaming or changing seed ratings does not reset existing versions. The content hash is a small local identifier, not a cryptographic integrity guarantee; use canonical SHA-256 when importing the catalog server-side. Raw keypress traces are not captured yet. Exports contain timestamps, the chosen name and attempt outcomes; share them intentionally.

The experiment is opted into each visit; refreshing preserves ratings but returns to normal practice. Stored user and level rows are intentionally separate: later multiplayer calibration needs many independent users playing the same level versions. Do not blindly merge two local level-rating rows or count both exports as the same global calibration. Retain source dataset IDs and original event order, then replay accepted outcomes under a defined migration policy.

## What to learn

1. Can each person find a comfortable difficulty within their first 5–10 rated runs?
2. Do recommendations remain enjoyable after alternating wins and losses?
3. Which authored difficulties seem out of order? Compare both people's exports.
4. Do hold/rest levels behave differently from simple tapping levels?
5. Is the 70% target useful, and does a first-attempt-only rating fit the Second bite experience?
6. Do display/input latency, keyboard versus touch, or interruptions explain surprising losses?

## Before Cloudflare Workers / D1

Keep the frontend and pure rating module. Add authentication, server-issued/versioned challenges, input traces and server-side adjudication, unique idempotency keys, atomic updates with revision conditions, and a policy for reconnects/abandonment. Translate the collections above into SQL tables with foreign keys and uniqueness constraints, and validate concurrency against D1's transaction/batch model rather than carrying over PostgreSQL row-lock assumptions. Use a separate database for preview/test environments.

Decide which results count globally (repeats, practice, abandoned runs), calibrate seed spread with many users, and simulate updates before publishing ratings. Add server telemetry for storage/API failures and prediction quality. Browser storage is a disposable experimental adapter, not an authoritative source or an automatic import into future public ratings.
