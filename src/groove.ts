// Patterns use sixteen steps per 4/4 bar, with one-, two- or four-bar phrases. Latin-inspired kick
// reductions are groove options, not complete traditional arrangements.
export const GROOVE_LAYERS = [
  { id: 'kick', name: 'Kick', entryBar: 2 },
  { id: 'snare', name: 'Snare', entryBar: 3 },
  { id: 'hats', name: 'Hi-hats', entryBar: 4 },
  { id: 'bass', name: 'Bass', entryBar: 5 },
  { id: 'synth', name: 'Funky synth', entryBar: 6 },
  { id: 'pad', name: 'Synth pad', entryBar: 7 },
] as const
export type LayerId = typeof GROOVE_LAYERS[number]['id']
export type GrooveHit = { step: number; notes?: string[]; durationSteps?: number; velocity?: number; articulation?: 'open' | 'rim' }
export type VoiceSettings = { oscillator: 'sine' | 'triangle' | 'sawtooth' | 'square'; cutoff: number; attack: number; decay: number; sustain: number; release: number }
export type SelectedPattern = { name: string; hits: GrooveHit[]; voice?: VoiceSettings; lengthSteps?: number }
export type GrooveSelection = Record<LayerId, SelectedPattern>

// Timbre and harmony vary together, while all pads stay in C minor.
export const PAD_SOUNDS = [
  { name: 'Warm cloud', oscillator: 'triangle', cutoff: 1000, attack: 0.16, chord: ['C3', 'Eb3', 'G3'], steps: [0], durations: [14] },
  { name: 'Velvet fifths', oscillator: 'sine', cutoff: 1600, attack: 0.04, chord: ['C3', 'G3', 'C4'], steps: [0, 8], durations: [5, 6] },
  { name: 'Soft strings', oscillator: 'sawtooth', cutoff: 850, attack: 0.35, chord: ['C3', 'Eb3', 'Bb3'], steps: [4], durations: [11] },
  { name: 'Hollow glow', oscillator: 'square', cutoff: 700, attack: 0.025, chord: ['C3', 'G3', 'Bb3'], steps: [2, 6, 10, 14], durations: [1.5, 1.5, 1.5, 1.5] },
  { name: 'Airy minor', oscillator: 'triangle', cutoff: 2800, attack: 0.4, chord: ['Eb4', 'G4', 'C5'], steps: [0, 10], durations: [7, 5] },
  { name: 'Low fog', oscillator: 'sine', cutoff: 500, attack: 0.5, chord: ['C3', 'Eb3', 'G3'], steps: [2], durations: [13] },
  { name: 'Chord chops', oscillator: 'sawtooth', cutoff: 1500, attack: 0.01, chord: ['G3', 'Bb3', 'C4'], steps: [0, 3, 8, 11], durations: [1, 2, 1, 2] },
  { name: 'Glass pulses', oscillator: 'sine', cutoff: 3500, attack: 0.006, chord: ['C4', 'Eb4', 'G4'], steps: [0, 6, 12], durations: [3, 3, 3] },
  { name: 'Dusk answer', oscillator: 'square', cutoff: 400, attack: 0.22, chord: ['Eb3', 'Bb3', 'C4'], steps: [6, 12], durations: [4, 3] },
  { name: 'Slow sunrise', oscillator: 'sawtooth', cutoff: 1800, attack: 0.65, chord: ['C3', 'G3', 'Eb4'], steps: [0], durations: [15] },
] as const

const BASS_VOICES: VoiceSettings[] = [
  { oscillator: 'sine', cutoff: 400, attack: .008, decay: .2, sustain: .7, release: .1 },
  { oscillator: 'triangle', cutoff: 900, attack: .003, decay: .12, sustain: .25, release: .05 },
  { oscillator: 'square', cutoff: 1400, attack: .002, decay: .06, sustain: .05, release: .025 },
  { oscillator: 'sawtooth', cutoff: 1800, attack: .005, decay: .16, sustain: .2, release: .04 },
  { oscillator: 'triangle', cutoff: 1800, attack: .02, decay: .2, sustain: .55, release: .12 },
]
const LEAD_VOICES: VoiceSettings[] = [
  { oscillator: 'sine', cutoff: 3000, attack: .003, decay: .25, sustain: .1, release: .15 },
  { oscillator: 'square', cutoff: 1400, attack: .002, decay: .06, sustain: 0, release: .03 },
  { oscillator: 'sawtooth', cutoff: 2200, attack: .006, decay: .12, sustain: .15, release: .06 },
  { oscillator: 'triangle', cutoff: 3500, attack: .015, decay: .3, sustain: .3, release: .12 },
  { oscillator: 'square', cutoff: 750, attack: .01, decay: .18, sustain: .4, release: .08 },
]
type DrumPattern = { name: string; steps: number[] }
function notes(name: string, steps: number[], pitches: string[], durations: number[], voice: VoiceSettings): SelectedPattern {
  return { name, voice, hits: steps.map((step, index) => ({
    step, notes: [pitches[index % pitches.length]],
    durationSteps: Math.min(durations[index % durations.length], (steps[index + 1] ?? (Math.floor(step / 16) + 1) * 16) - step),
    velocity: index % 3 === 0 ? .8 : .55,
  })) }
}

export const GROOVE_PATTERNS = {
  kick: [
    { name: 'Four on the floor', steps: [0, 4, 8, 12] },
    { name: 'Habanera-inspired', steps: [0, 3, 4, 6, 8, 11, 12, 14] },
    { name: 'Bass tumbao-inspired', steps: [6, 8, 14] },
    { name: 'Rumba-inspired', steps: [0, 3, 7, 10, 12] },
    { name: 'Baião-inspired', steps: [0, 3, 6, 8, 11, 14] },
    { name: 'Heartbeat', steps: [0, 8] },
    { name: 'Double push', steps: [0, 2, 8, 10] },
    { name: 'Broken beat', steps: [0, 7, 10] },
    { name: 'Offbeat drive', steps: [2, 6, 10, 14] },
    { name: 'Last beat pickup', steps: [0, 8, 12, 15] },
  ] satisfies DrumPattern[],
  snare: [
    { name: 'Backbeat', steps: [4, 12] },
    { name: 'Half-time', steps: [8] },
    { name: 'Disco', steps: [4, 10, 12] },
    { name: 'Offbeat answer', steps: [4, 11, 14] },
    { name: 'Turnaround', steps: [4, 12, 15] },
    { name: 'Sparse answer', steps: [12] },
    { name: 'Two and four ghosts', steps: [4, 7, 12, 14] },
    { name: 'Three knocks', steps: [3, 8, 14] },
    { name: 'Double backbeat', steps: [4, 5, 12, 13] },
    { name: 'Late reply', steps: [6, 14] },
  ] satisfies DrumPattern[],
  hats: [
    { name: 'Quarter notes', steps: [0, 4, 8, 12] },
    { name: 'Eighth notes', steps: [0, 2, 4, 6, 8, 10, 12, 14] },
    { name: 'Offbeats', steps: [2, 6, 10, 14] },
    { name: 'Skipping', steps: [0, 2, 6, 8, 10, 14, 15] },
    { name: 'Sixteenth bursts', steps: [0, 2, 3, 6, 8, 10, 11, 14] },
    { name: 'Half-time ticks', steps: [0, 8] },
    { name: 'Sixteenth motor', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    { name: 'Three-three-two', steps: [0, 3, 6, 8, 11, 14] },
    { name: 'Late shuffle', steps: [0, 3, 4, 7, 8, 11, 12, 15] },
    { name: 'Short chatter', steps: [2, 3, 6, 10, 11, 14, 15] },
  ] satisfies DrumPattern[],
  // Shared C minor pentatonic palette keeps independent choices compatible.
  bass: [
    notes('Root pulse', [0, 8], ['C2'], [6, 5], BASS_VOICES[0]),
    notes('Root and fifth', [0, 6, 8, 14], ['C2', 'G1'], [3, 1, 4, 1], BASS_VOICES[1]),
    notes('Octave bounce', [0, 3, 8, 11], ['C2', 'C3'], [0.6, 0.6], BASS_VOICES[2]),
    notes('Funk walk', [0, 3, 6, 10, 14], ['C2', 'C2', 'Eb2', 'G1', 'Bb1'], [1, 0.7, 2, 1, 1], BASS_VOICES[3]),
    notes('Anticipation', [2, 6, 10, 14], ['C2', 'G1', 'Bb1', 'C2'], [3], BASS_VOICES[4]),
    notes('Deep anchor', [0], ['C1'], [14], BASS_VOICES[0]),
    notes('Climbing pocket', [0, 2, 5, 8, 10, 13], ['C2', 'Eb2', 'G2', 'Bb2', 'G2', 'Eb2'], [1], BASS_VOICES[1]),
    notes('High pluck', [3, 7, 11, 15], ['C3', 'G2', 'Bb2', 'G2'], [0.5], BASS_VOICES[2]),
    notes('Long and short', [0, 7, 8, 15], ['C2', 'G1', 'Eb2', 'Bb1'], [5, 0.5, 5, 0.5], BASS_VOICES[3]),
    notes('Rolling eighths', [0, 2, 4, 6, 8, 10, 12, 14], ['C2', 'G1', 'C2', 'Eb2', 'G2', 'Eb2', 'Bb1', 'G1'], [1.4], BASS_VOICES[4]),
  ],
  synth: [
    notes('Single answer', [10], ['G4'], [4], LEAD_VOICES[0]),
    notes('Offbeat stabs', [2, 6, 10, 14], ['C4', 'G4'], [0.5], LEAD_VOICES[1]),
    notes('Funky hook', [2, 7, 10, 15], ['G4', 'Bb4', 'Eb4', 'C5'], [1, 0.6, 2, 0.5], LEAD_VOICES[2]),
    notes('Call and response', [0, 3, 10, 13], ['C5', 'Bb4', 'G4', 'Eb4'], [2, 1, 2, 1], LEAD_VOICES[3]),
    notes('Little climb', [6, 8, 10, 14], ['C4', 'Eb4', 'G4', 'Bb4'], [1, 1, 3, 1], LEAD_VOICES[4]),
    notes('Descending bells', [0, 4, 8, 12], ['C5', 'Bb4', 'G4', 'Eb4'], [3], LEAD_VOICES[0]),
    notes('Tiny echoes', [1, 3, 9, 11], ['G5', 'G4', 'Eb5', 'Eb4'], [0.5], LEAD_VOICES[1]),
    notes('Singing fifth', [0, 8], ['C4', 'G4'], [6], LEAD_VOICES[2]),
    notes('Sixteenth lick', [8, 9, 10, 11, 14], ['C4', 'Eb4', 'G4', 'Bb4', 'C5'], [0.5], LEAD_VOICES[3]),
    notes('Sparse high reply', [6, 14], ['Bb5', 'G5'], [1.8], LEAD_VOICES[4]),
  ],
  pad: PAD_SOUNDS.map((sound): SelectedPattern => ({
    name: sound.name,
    voice: { oscillator: sound.oscillator, cutoff: sound.cutoff, attack: sound.attack,
      decay: .3, sustain: .65, release: sound.steps.length > 2 ? .07 : .25 },
    hits: sound.steps.map((step, index) => ({ step, notes: [...sound.chord], durationSteps: sound.durations[index], velocity: .6 })),
  })),
}

// Longer phrases and expressive parts use the same hit format as simple loops.
function drumPart(name: string, steps: number[], lengthSteps = 16): SelectedPattern {
  return { name, lengthSteps, hits: steps.map((step, index) => ({ step, velocity: index % 2 ? .5 : .8 })) }
}
function chordPart(name: string, steps: number[], durationSteps: number, lengthSteps = 16): SelectedPattern {
  return { name, lengthSteps, voice: { ...LEAD_VOICES[3], attack: .02, sustain: .5 },
    hits: steps.map((step) => ({ step, durationSteps, notes: ['C3', 'Eb3', 'G3'], velocity: .6 })) }
}

export const EXTRA_PARTS: Record<LayerId, SelectedPattern[]> = {
  kick: [
    drumPart('Downbeat only', [0]),
    drumPart('Answer the pocket', [3, 11]),
    drumPart('Two-bar question', [0, 8, 16, 22, 28], 32),
    drumPart('Four-bar pickup', [0, 8, 16, 24, 32, 40, 48, 56, 60, 62, 63], 64),
    drumPart('Space then reply', [0, 24, 30], 32),
  ],
  snare: [
    { ...drumPart('Rim backbeat', [4, 12]), hits: [4, 12].map((step) => ({ step, articulation: 'rim', velocity: .65 })) },
    { name: 'Ghost pocket', hits: [
      { step: 4, velocity: .8 }, { step: 7, velocity: .18 },
      { step: 12, velocity: .8 }, { step: 15, velocity: .22 },
    ] },
    drumPart('Two-bar roll', [4, 12, 20, 28, 29, 30, 31], 32),
    drumPart('Phrase end fill', [4, 12, 20, 28, 36, 44, 52, 58, 60, 61, 62, 63], 64),
    drumPart('Room to breathe', [4, 12, 28], 32),
  ],
  hats: [
    drumPart('Pedal two and four', [4, 12]),
    { name: 'Open offbeats', hits: [2, 6, 10, 14].map((step) => ({ step, articulation: 'open', velocity: .55 })) },
    { name: 'Closed with open answer', hits: [0, 2, 4, 6, 8, 10, 12, 14].map((step) => ({ step, articulation: step === 14 ? 'open' : undefined, velocity: .6 })) },
    drumPart('Two-bar chatter', [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 29, 30, 31], 32),
    drumPart('Leave a bar open', [0, 2, 4, 6, 8, 10, 12, 14], 32),
  ],
  bass: [
    notes('Quarter-note walk', [0, 4, 8, 12], ['C2', 'Eb2', 'G2', 'Bb1'], [3.5], BASS_VOICES[1]),
    notes('Sixteenth pedal', Array.from({ length: 16 }, (_, step) => step), ['C2'], [.5], BASS_VOICES[2]),
    { ...notes('Two-bar bass story', [0, 6, 12, 16, 20, 24, 30], ['C2', 'G1', 'Bb1', 'Eb2', 'G2', 'Eb2', 'C2'], [3, 2, 1], BASS_VOICES[3]), lengthSteps: 32 },
    { name: 'Long root answer', lengthSteps: 32, voice: BASS_VOICES[0], hits: [
      { step: 0, notes: ['C2'], durationSteps: 12, velocity: .65 },
      { step: 24, notes: ['G1'], durationSteps: 6, velocity: .6 },
    ] },
    { ...notes('Bass call then silence', [0, 3, 6, 10], ['C2', 'Eb2', 'G2', 'C3'], [1], BASS_VOICES[1]), lengthSteps: 32 },
  ],
  synth: [
    notes('Single-note motor', [0, 2, 4, 6, 8, 10, 12, 14], ['G4'], [.7], LEAD_VOICES[1]),
    notes('Arpeggio loop', Array.from({ length: 16 }, (_, step) => step), ['C4', 'Eb4', 'G4', 'Bb4'], [.65], LEAD_VOICES[0]),
    { ...notes('Two-bar melody', [0, 4, 7, 12, 16, 22, 28], ['C4', 'Eb4', 'G4', 'Bb4', 'G4', 'Eb4', 'C4'], [2, 1, 3], LEAD_VOICES[3]), lengthSteps: 32 },
    { ...notes('A bar to answer', [16, 20, 24, 30], ['G4', 'Bb4', 'Eb4', 'C4'], [2], LEAD_VOICES[2]), lengthSteps: 32 },
    { ...notes('Four-bar refrain', [0, 3, 10, 16, 19, 26, 32, 35, 42, 52, 60],
      ['C4', 'G4', 'Eb4', 'C4', 'G4', 'Eb4', 'C4', 'G4', 'Eb4', 'Bb4', 'C5'], [1], LEAD_VOICES[4]), lengthSteps: 64 },
  ],
  pad: [
    chordPart('Two and four', [4, 12], 2),
    chordPart('Quarter chord pulse', [0, 4, 8, 12], 2),
    { ...chordPart('Two-bar swell', [0], 30, 32), voice: { ...LEAD_VOICES[3], attack: .5, sustain: .7, release: .4 } },
    { name: 'Broken chord answer', lengthSteps: 32, voice: LEAD_VOICES[0], hits: [0, 4, 8, 12, 20, 24, 28].map((step, index) => ({ step, notes: [['C3', 'Eb3', 'G3', 'Bb3'][index % 4]], durationSteps: 3, velocity: .6 })) },
    { ...chordPart('Four-bar harmony', [0, 16, 32, 48], 14, 64), hits: [
      ['C3', 'Eb3', 'G3'], ['Eb3', 'G3', 'Bb3'], ['Bb2', 'Eb3', 'G3'], ['C3', 'G3', 'C4'],
    ].map((notes, index) => ({ step: index * 16, notes, durationSteps: 14, velocity: .6 })) },
  ],
}

// Extra chord and timekeeper parts remain playable with any chosen sound.
EXTRA_PARTS.pad.push(
  chordPart('Funk sixteenth chops', [0, 3, 6, 7, 10, 14, 15], .55),
  chordPart('Muted upstroke pocket', [2, 5, 6, 10, 13, 14], .45),
  chordPart('Disco guitar skank', [2, 6, 10, 14], .8),
  chordPart('Two-bar guitar answer', [0, 3, 6, 12, 18, 22, 25, 28, 31], .6, 32),
)
EXTRA_PARTS.hats.push(
  { name: 'Shaker push pull', hits: Array.from({ length: 16 }, (_, step) => ({ step, velocity: [ .65, .25, .85, .35 ][step % 4] })) },
  { name: 'Shaker skip and chatter', hits: [0, 2, 3, 6, 7, 8, 10, 11, 14, 15].map((step) => ({ step, velocity: step % 2 ? .35 : .8 })) },
  { name: 'Shaker two-bar answer', lengthSteps: 32, hits: [0, 2, 6, 8, 10, 14, 16, 18, 19, 22, 24, 26, 27, 30, 31].map((step) => ({ step, velocity: step % 2 ? .4 : .75 })) },
  { name: 'Shaker three accents', hits: Array.from({ length: 16 }, (_, step) => ({ step, velocity: [0, 6, 12].includes(step) ? .9 : .25 })) },
)

export function patternOptions(id: LayerId): SelectedPattern[] {
  return [...GROOVE_PATTERNS[id].map(normalizePattern), ...EXTRA_PARTS[id]]
}

// Phrase time starts when a layer enters, so a two-bar part gets a full first bar.
export function hitsAtStep(pattern: SelectedPattern, step: number): GrooveHit[] {
  const position = step % (pattern.lengthSteps ?? 16)
  return pattern.hits.filter((hit) => hit.step === position)
}

export function pickRandom<T>(options: readonly T[], random: () => number): T {
  if (!options.length) throw new Error('A groove layer needs at least one option')
  return options[Math.floor(random() * options.length)]
}

function normalizePattern(pattern: DrumPattern | SelectedPattern): SelectedPattern {
  if ('steps' in pattern) return { name: pattern.name, hits: pattern.steps.map((step, index) => ({ step, velocity: index % 3 === 0 ? .8 : .5 })) }
  return pattern
}

// Choose independently once per run. Adding options needs only a catalog edit.
export function chooseGroove(random: () => number = Math.random): GrooveSelection {
  return Object.fromEntries(GROOVE_LAYERS.map(({ id }) => [
    id, pickRandom(patternOptions(id), random),
  ])) as GrooveSelection
}

export function unlockedLayerCount(successfulBars: number) {
  return GROOVE_LAYERS.filter((layer) => successfulBars >= layer.entryBar - 1).length
}
