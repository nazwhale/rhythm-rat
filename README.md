# Rhythm Run

A small browser rhythm sight-reading game built with React, TypeScript, Vite, VexFlow and Tone.js. The first level is an eight-bar 4/4 run at 110 BPM, using quarter notes and eighth notes.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL Vite prints. Click **Start Run** (or press Space) to hear the four-beat count-in. Tap Space for each note onset. The score grades note presses within 60 ms as Perfect and within 120 ms as Good; the end screen reports pass/fail, counts and longest streak. The sound toggle mutes the gameplay metronome while keeping the count-in audible.

The rhythm pattern lives in `src/level.ts`, the VexFlow score is in `src/Staff.tsx`, and the game loop and scoring are in `src/App.tsx`.

## Streak music

Successful bars build a six-layer groove: kick after 1, snare after 2,
hi-hats after 3, bass after 4, funky synth after 5, and a soft synth pad after 6 (bar 7). Layers accumulate
for the rest of the run. A failed run, restart, or level change resets them.
A tied hold must be released successfully before its bar earns a layer;
cross-bar ties can therefore delay an unlock. The music follows the game BPM
and shares the main mute control. The first bar has only the metronome.

The sounds are synthesized with Tone.js, so no samples are required
to play. Patterns live in `src/groove.ts`, separate from the instruments in
`src/grooveAudio.ts`. Each run independently selects one of fifteen parts per layer. Choices stay fixed for that run; repeats across runs
are possible. Latin-inspired kick patterns are simplified 4/4 reductions.

For a sampled kit, supply dry, tightly trimmed WAV one-shots (44.1 or 48 kHz,
16 or 24 bit, no leading silence):

- Kick, snare, closed hi-hat; optionally an open hi-hat.
- A bass note with its root pitch labelled (ideally C2).
- A short funky synth stab with its root pitch labelled (ideally C4).

Bass and synth should share a compatible key. Include permission to use the
samples in the app. One-shots let the sequencer work at any level tempo;
full loops would need their BPM, key, and exact bar length documented.
For future variation, add several sounds per instrument and compatible
16-step patterns, with kit and pattern choices made at bar boundaries.

Music configuration: `src/groove.ts` owns layer entry bars, pattern options, pad
presets, and per-run random selection. `src/grooveAudio.ts` creates the instruments
and schedules normalized hits. Add patterns to the catalog; selection uses the
actual option count. Pad presets define a timbre and compatible chord voicing.

Bass and lead choices now include distinct voice settings, note lengths and
accents. Chord choices combine different rhythms, registers and
envelopes; the pad mix remains at -38 dB. All selections stay fixed per run.

Lead instrument selection (`chooseLeadInstrument`) picks synth lead, guitar,
flute or trumpet. Chord selection (`chooseChordInstrument`) picks synth pad,
piano or strummed guitar chords. These are synthesized approximations, chosen
independently of the rhythmic parts. The HUD uses the chosen instrument's icon.
Choices live in `src/musicInstruments.ts`.

Parts may have a `lengthSteps` of 16, 32 or 64; omitted means one bar. Each
layer starts its phrase at its own unlock bar. Extra parts include chord stabs
on 2 and 4, open hats, rim clicks, ghost notes, phrase-end fills, walking bass,
arpeggios, multi-bar harmony and intentional silent bars. Random choices stay
fixed for the run, so the music stays coherent while the parts develop.

The timekeeper layer randomly chooses hi-hats or shaker through
`chooseTimekeeperInstrument`. Both play the same `hats` pattern catalog;
`createTimekeeper` handles only the sound. The shaker ignores open-hat
articulation while preserving timing and accents. Its HUD icon follows the
chosen instrument. Cowbell is available separately in the bite-sound menu.

Style presets live in `src/musicStyles.ts`: Pocket Funk, Sunset Latin,
Moonlight Lounge and Neon Arcade. A run chooses a style, then selects patterns
and instruments from that style's explicit pools. New funk chord chops and
accented shaker parts are shared catalog entries, so compatible presets can
reuse them. Guitar chord gain is -28 dB (6 dB above its previous level).

After a successful level the full groove continues, until Next Level is clicked, which disposes it before the next ready screen.
Failed attempts and manual level selection stop the old audio. The continuation
clock is independent of rendering, skips stale steps after pauses, and is
cleaned up with its audio engine. Background-tab timer throttling can still
interrupt playback. `npm test` covers styles and continuous clock behavior.

## Local rating experiment

Open **Rating experiment** to try first-attempt Glicko-2 ratings saved in your browser. Choose **Find my next challenge**, then start the run normally. Export and reset controls are included; each browser learns independently. See [the experiment guide](docs/local-rating-lab.md) for rating policy, stored schema, testing questions and the later Workers/D1 path.
