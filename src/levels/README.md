# Rhythm Rat levels

Each JSON file is discovered automatically. Levels currently run in ascending order of their provisional rating, starting with Steady Bites. Passing advances immediately; failing offers one retry, then advances. After the final level, the sequence loops. Attempts are per encounter and reset on a new level or page reload.

```json
{
  "id": "unique-stable-id",
  "title": "Display name",
  "bpm": 110,
  "beatsPerBar": 4,
  "rating": 1000,
  "bars": [
    ["q", "q", "q", "q"],
    ["q", "8", "8", "q", "q"],
    ["q", "q", "q", "q"],
    ["q", "q", "q", "q"],
    ["q", "q", "q", "q"],
    ["q", "q", "q", "q"],
    ["q", "q", "q", "q"],
    ["q", "q", "q", "q"]
  ]
}
```

`q` is a crotchet (one beat), `8` is a quaver (half a beat), and `h` is a minim (two beats). Events follow one another in time. Each bar must total four beats, and each level must have eight bars. Tempo is fixed at 110 BPM for now. Use an object for modifiers:

- `{ "duration": "8", "rest": true }`: a quaver rest, with no cheese or press.
- `{ "duration": "q", "dotted": true }`: a dotted crotchet (1.5 beats).
- `{ "duration": "8", "tie": true }`: tie this quaver to the next written note, including across a bar line.

A tie chain is one attack and one continuous hold until the **onset of the final tied note**. This is the game’s input gesture: release when that note arrives, without pressing again for the tie target. Its written duration remains visible in the notation but does not extend the hold into the following note. Release within 120 ms of that arrival; early release or holding too long fails. Ties cannot connect to rests or run beyond the level. Untied notes remain taps. Pitch, chord symbols and articulation marks from references are intentionally omitted in this rhythm-only game.

## Screenshot rhythm coverage

The two new eight-bar levels use these source bars from the supplied “Come So Far” screenshot. Repeated bars in the source are represented once per distinct rhythm/continuation pattern:

| Level | Source bars in order |
| --- | --- |
| Rest & Relish | 26, 27, 32, 33, 34, 35, 36, 37 |
| Midnight Munch | 40, 41, 48, 49, 50, 51, 52, 53 |

Source bars 28/30 repeat 26; 29/31 repeat 27. Bars 38/42/46 repeat 34, 39/43/47 repeat 35, and 44/45 repeat 36/37. Bar 40 has the same written durations as 34/36 but ties into the longer opening note of 41. The final source row is bars 50–53. Both levels finish with a resolved tie rather than leaving a hold dangling into another level.

Dots beside notes indicate dotted durations; the small articulation dots above notes do not lengthen them. The final dotted crotchets and final minim are preserved. Unsupported notes and malformed bars fail validation.

## Future ratings

`rating` is a provisional seed, not a live Elo score. The ids let future stored results reference a level independently of its title or file name. No player rating, matchmaking or rating changes are implemented yet.

For future matchmaking, select levels within 100 points of the player's rating. Define the difference as **player rating minus level rating**: positive means the player is favoured; negative means the level is favoured. Record the first-attempt result and second-attempt result separately so retries do not count as independent first encounters. Decide how second-bite wins affect ratings before implementing updates. Shared level ratings will need a backend that aggregates outcomes across players.

Run `npm test` to check bar totals, source rhythm coverage, rest/tie scheduling, input/release windows and two-attempt progression. Run `npm run build` for the TypeScript and production build checks.

## Learning progression

All levels stay at 110 BPM and eight bars. The four stepping-stone ratings sit between The First Lap and Rest & Relish; ratings remain provisional rather than measured difficulty.

| Order | Level | Introduces |
| --- | --- | --- |
| 1 | Steady Bites | Crotchets |
| 2 | The First Lap | Paired quavers |
| 3 | Pause for Cheese | Quarter-note rests in repeated familiar patterns |
| 4 | Offbeat Nibbles | Eighth-note rests and off-beat entries, without holds |
| 5 | A Little Stretch | Exactly one quarter-to-quarter hold in bar four, surrounded by familiar bars |
| 6 | Across the Cracks | Three holds: one short, one across a bar line, and one familiar longer hold |
| 7 | Rest & Relish | Mixed rests, syncopation, frequent ties and dotted crotchets |
| 8 | Midnight Munch | Denser combinations, repeated cross-bar ties and a final minim |

The stepping stones deliberately repeat patterns and include recovery bars. Dotted durations and minims remain in the last two levels. Adding the JSON files automatically includes them in the development picker and normal progression.
