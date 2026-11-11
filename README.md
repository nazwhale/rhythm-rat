# Rhythm Run

A small browser rhythm sight-reading game built with React, TypeScript, Vite, VexFlow and Tone.js. The first level is an eight-bar 4/4 run at 110 BPM, using quarter notes and eighth notes.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL Vite prints. Click **Start Run** (or press Space) to hear the four-beat count-in. Tap Space for each note onset. The score grades note presses within 60 ms as Perfect and within 120 ms as Good; the end screen reports pass/fail, counts and longest streak. The sound toggle mutes the gameplay metronome while keeping the count-in audible.

The rhythm pattern lives in `src/level.ts`, the VexFlow score is in `src/Staff.tsx`, and the game loop and scoring are in `src/App.tsx`.
