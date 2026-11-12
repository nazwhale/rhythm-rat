# Rhythm Rat levels

Each JSON file is discovered automatically. Levels currently run in ascending order of their provisional rating, starting with Tiny Nibbles. Passing ends in the mouse hole; continue to the next level with Space, a tap or Next Level. The first failure immediately reloads the same level with a fading “Second bite” notice. The second failure shows a red pixel-art mousetrap loss screen and selects the previous, easier level (or stays on Tiny Nibbles if already at the easiest level). The Another Level button starts that level’s count-in immediately; it also supports Enter or Space when focused. Only a win advances to a harder level. From either ready scene, Space or a tap starts the one-bar count-in. After winning the final level, the sequence loops. Attempts are per encounter and reset on a new level or page reload.

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

All levels stay at 110 BPM and eight bars. Six beginner additions precede The First Lap, starting with half notes before building toward Steady Bites, all easier than the original level 3, Pause for Cheese. They use no rests or holds, at most one quaver pair per bar, and at least four bars without quavers. The four stepping-stone ratings sit between The First Lap and Rest & Relish; ratings remain provisional rather than measured difficulty.

| Order | Level | Introduces |
| --- | --- | --- |
| 1 | Tiny Nibbles | Two minims per bar: two evenly spaced taps |
| 2 | Little Paws | Minims followed by two crotchets, alternating with minim-only bars |
| 3 | Cheese at Dusk | Two crotchets followed by a minim, alternating with minim-only bars |
| 4 | Double Helping | Alternating minim-only and crotchet-only bars |
| 5 | Middle Munch | Familiar minim and crotchet combinations |
| 6 | Steady Bites | Crotchets |
| 7 | Around the Block | One quaver pair in alternating bars, with minims and recovery bars |
| 8 | The First Lap | Multiple quaver pairs per bar |
| 9 | Pause for Cheese | Quarter-note rests in repeated familiar patterns |
| 10 | Offbeat Nibbles | Eighth-note rests and off-beat entries, without holds |
| 11 | A Little Stretch | Exactly one quarter-to-quarter hold in bar four, surrounded by familiar bars |
| 12 | Across the Cracks | Three holds: one short, one across a bar line, and one familiar longer hold |
| 13 | Rest & Relish | Mixed rests, syncopation, frequent ties and dotted crotchets |
| 14 | Midnight Munch | Denser combinations, repeated cross-bar ties and a final minim |

The stepping stones deliberately repeat patterns and include recovery bars. Dotted durations remain in the last two levels; beginner minims are untied taps with a two-beat gap before the next note. Adding the JSON files automatically includes them in the public level picker and normal progression.


## Play feedback and sound

Tap/Space timing uses the same 120 ms acceptance window. Perfect is within 35 ms, Good within 75 ms, and accepted Early/Late taps occupy the outer part of that window. Feedback floats above the corresponding note and travels with it while fading. Touch/pointer down starts a bite or hold; pointer up releases a hold, and cancellation or loss of focus fails an active hold.

Bite sounds can be switched live between Soft nom, Crunch, Musical, and No bite sound. The main sound toggle also mutes the metronome. Every successful run ends with the rat diving into a disco hole. Lights reveal a spinning mirror ball and dancing mice after the dive, with a seeded random palette, dance timing and confetti spread on each run. After the dive, a wall cutaway opens rightward from the original doorway to reveal a larger club with bottle-cap decks, cheese-grater speakers and a dance floor. Each run selects two distinct scenes from twenty surprises using `chooseDiscoSurprises(seed)` in `src/discoSurprises.tsx`; add a scene and registry entry there to extend the collection. Later levels add more guests. A run with every onset judged Perfect unlocks a golden crown and an extended confetti encore. Reduced-motion preferences show the lit party without the animated effects.
