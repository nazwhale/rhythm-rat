# Puzzle difficulty coverage — 15 November 2026

Snapshot: production model `current-1000`, through result sequence 38; 24 current puzzles and two players. This was a read-only audit. No scores, seeds or results were changed. Private raw inputs are in gitignored `.backups/difficulty-audit-20261115.json`; this report uses anonymous player labels.

The strongest priorities are **genuinely easier puzzles around 800–1100**, followed by **more variety around 1450–1600**. Avoid adding more puzzles to the crowded 1300–1450 band for now.

| Current online puzzle rating | Puzzles | Recorded runs against those puzzles | Assessment |
|---|---:|---:|---|
| Below 1100 | 0 | 0 | Biggest missing band: onboarding |
| 1100–1299 | 2 | 4 | Thin bridge above beginner content |
| 1300–1449 | 12 | 20 | Half the catalog; adequate variety |
| 1450–1549 | 1 | 4 | Main variety gap for the stronger player |
| 1550–1649 | 2 | 3 | Add a few transition puzzles |
| 1650–1749 | 6 | 7 | Already represented; needs calibration |
| 1750+ | 1 | 0 | Only Midnight Munch (1800); future gap, little current demand evidence |

These bins use today's learned rating, not a puzzle's starting seed. Runs are counted by the puzzle's current band; they are not a claim that it had that rating at the time of play.

## Beginner coverage

Player 2 has rating **1015**, RD **207**, and **one win from five rated results**. The easiest current puzzle, Cheese at Dusk, is rated **1181**, with RD **194**. The model estimates only **31%** expected score for that player against it. Little Paws is about **22%**, and Tiny Nibbles about **18%**.

For a player near 1000, a 70% expected-score target calls for puzzles roughly **830–850** (depending on puzzle RD). The entire current catalog is above that. A new player's early experience therefore cannot approach the intended 70% recommendation target: the system can only choose the nearest available challenge.

Add a starter group around **800, 850, 900 and 950**, followed by bridging patterns around **1050 and 1125**. Make the rhythms genuinely easier, rather than merely assigning existing hard patterns lower seeds: fewer required attacks, repeated on-beat patterns and clear recovery gaps, with one new idea introduced at a time. Keep the eight-bar format. The present all-or-nothing completion rule means even simple patterns may still be demanding over a full run.

## Intermediate variety

Player 1 has rating **1677**, RD **82**, and **24 wins from 33 results (73%)**. Overall difficulty is close to the intended target, but the useful challenge band has very little variety:

| Puzzle | Current rating | Expected score for Player 1 |
|---|---:|---:|
| Whisker Shuffle | 1419 | 79% |
| A Little Stretch | 1522 | 69% |
| Pause for Cheese | 1584 | 62% |

**A Little Stretch is the sole puzzle between 1450 and 1549.** Once recent-puzzle avoidance excludes it, recommendations have to move farther from the 70% target. Add **four varied puzzles around 1450, 1475, 1525 and 1575**. Reuse familiar concepts in different patterns and introduce difficult combinations gradually.

There is also a literal gap between Whisker Shuffle (1419) and A Little Stretch (1522), then another step to Pause for Cheese (1584). These are useful authoring targets, rather than evidence of precisely calibrated 25-point distinctions.

## Suggested next batch

| Priority | Target online ratings | New puzzles |
|---|---|---:|
| 1: starter group | 800, 850, 900, 950 | 4 |
| 2: beginner bridge | 1050, 1125 | 2 |
| 3: intermediate variety | 1450, 1475, 1525, 1575 | 4 |

If building only six next, prioritize **four starters and two intermediate patterns around 1475 and 1525**.

The JSON `rating` field is the **authored seed**, and the current model adds **500** to initialize its online difficulty. To start a new puzzle near 850, use an authored seed near **350**, not 850. Existing versions retain their immutable seeds; create new puzzle content to expand coverage. These are starting hypotheses: let real results move the learned ratings.

## Confidence and limits

Only 38 results from two people are available, 33 from the same person. Puzzle RD ranges roughly **143–200**, and three puzzles have no plays. A 100-point difference is not yet a reliable fine-grained ordering. A single failure does not prove a particular note type or pattern is intrinsically hard. Repeated encounters also reflect practice and are not independent trials.

The missing easy catalog is a clear structural gap even with little data. The 1450–1600 recommendation-variety gap is supported by the current catalog and Player 1's ability. Exact seed choices, note-type effects and demand above 1750 remain provisional.

Expected-score estimates use the application's actual `expectedScore()` function, including puzzle uncertainty. The 70% target is expected score; draws count half. All 38 results in this snapshot were wins or losses. Audit snapshots should be refreshed after the next batch has been played by more people.
