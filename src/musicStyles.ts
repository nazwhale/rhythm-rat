import { GROOVE_LAYERS, patternOptions, pickRandom, type LayerId, type GrooveSelection } from './groove.ts'
import { LEAD_INSTRUMENTS, CHORD_INSTRUMENTS, BASS_INSTRUMENTS, TIMEKEEPER_INSTRUMENTS, type MusicInstruments } from './musicInstruments.ts'

type InstrumentPools = { [K in keyof MusicInstruments]: readonly MusicInstruments[K]['id'][] }
export type MusicStyle = {
  id: string; name: string
  instruments: InstrumentPools
  parts: Record<LayerId, readonly string[]>
}

// Explicit musical pools are easy to audit: adding a style never changes playback.
export const MUSIC_STYLES: MusicStyle[] = [
  { id: 'funk', name: 'Pocket Funk', instruments: {
    lead: ['guitar', 'synth', 'trumpet'], chords: ['guitar', 'piano'], bass: ['bassGuitar', 'synth'], timekeeper: ['shaker', 'hiHat'],
  }, parts: {
    kick: ['Heartbeat', 'Broken beat', 'Double push', 'Two-bar question'],
    snare: ['Backbeat', 'Ghost pocket', 'Two and four ghosts', 'Two-bar roll'],
    hats: ['Shaker push pull', 'Shaker skip and chatter', 'Shaker two-bar answer', 'Closed with open answer', 'Sixteenth bursts'],
    bass: ['Funk walk', 'Long and short', 'Octave bounce', 'Climbing pocket', 'Two-bar bass story'],
    synth: ['Funky hook', 'Call and response', 'Single-note motor', 'Four-bar refrain'],
    pad: ['Funk sixteenth chops', 'Muted upstroke pocket', 'Disco guitar skank', 'Two-bar guitar answer', 'Two and four'],
  } },
  { id: 'latin', name: 'Sunset Latin', instruments: {
    lead: ['flute', 'trumpet', 'guitar'], chords: ['piano', 'guitar'], bass: ['bassGuitar', 'doubleBass'], timekeeper: ['shaker'],
  }, parts: {
    kick: ['Habanera-inspired', 'Bass tumbao-inspired', 'Baião-inspired', 'Rumba-inspired'],
    snare: ['Rim backbeat', 'Late reply', 'Room to breathe'],
    hats: ['Three-three-two', 'Shaker three accents', 'Shaker skip and chatter', 'Shaker two-bar answer'],
    bass: ['Anticipation', 'Root and fifth', 'Two-bar bass story'],
    synth: ['Little climb', 'Call and response', 'A bar to answer', 'Two-bar melody'],
    pad: ['Chord chops', 'Hollow glow', 'Disco guitar skank', 'Two-bar guitar answer', 'Broken chord answer'],
  } },
  { id: 'mellow', name: 'Moonlight Lounge', instruments: {
    lead: ['flute', 'guitar'], chords: ['piano', 'pad'], bass: ['doubleBass', 'bassGuitar'], timekeeper: ['shaker', 'hiHat'],
  }, parts: {
    kick: ['Downbeat only', 'Heartbeat', 'Space then reply'],
    snare: ['Rim backbeat', 'Half-time', 'Sparse answer', 'Room to breathe'],
    hats: ['Half-time ticks', 'Pedal two and four', 'Quarter notes', 'Shaker two-bar answer'],
    bass: ['Quarter-note walk', 'Root pulse', 'Long root answer', 'Deep anchor'],
    synth: ['Singing fifth', 'Single answer', 'Sparse high reply', 'A bar to answer'],
    pad: ['Warm cloud', 'Velvet fifths', 'Two-bar swell', 'Four-bar harmony', 'Two and four'],
  } },
  { id: 'arcade', name: 'Neon Arcade', instruments: {
    lead: ['synth'], chords: ['pad', 'piano'], bass: ['synth'], timekeeper: ['hiHat', 'shaker'],
  }, parts: {
    kick: ['Four on the floor', 'Double push', 'Last beat pickup'],
    snare: ['Backbeat', 'Disco', 'Double backbeat', 'Phrase end fill'],
    hats: ['Eighth notes', 'Sixteenth motor', 'Open offbeats', 'Shaker push pull'],
    bass: ['Octave bounce', 'Sixteenth pedal', 'Rolling eighths', 'High pluck'],
    synth: ['Arpeggio loop', 'Sixteenth lick', 'Tiny echoes', 'Four-bar refrain'],
    pad: ['Hollow glow', 'Glass pulses', 'Quarter chord pulse', 'Airy minor'],
  } },
]

export function stylePatternOptions(style: MusicStyle, layer: LayerId) {
  const catalog = patternOptions(layer)
  return style.parts[layer].map((name) => {
    const part = catalog.find((pattern) => pattern.name === name)
    if (!part) throw new Error(`Unknown ${layer} part in ${style.id}: ${name}`)
    return part
  })
}
function chooseFromPool<T extends { id: string }>(catalog: readonly T[], ids: readonly string[], random: () => number): T {
  return pickRandom(ids.map((id) => {
    const instrument = catalog.find((candidate) => candidate.id === id)
    if (!instrument) throw new Error(`Unknown style instrument: ${id}`)
    return instrument
  }), random)
}
export function chooseStyleArrangement(random: () => number = Math.random) {
  const style = pickRandom(MUSIC_STYLES, random)
  const patterns = Object.fromEntries(GROOVE_LAYERS.map(({ id }) => [id, pickRandom(stylePatternOptions(style, id), random)])) as GrooveSelection
  const instruments: MusicInstruments = {
    lead: chooseFromPool(LEAD_INSTRUMENTS, style.instruments.lead, random),
    chords: chooseFromPool(CHORD_INSTRUMENTS, style.instruments.chords, random),
    bass: chooseFromPool(BASS_INSTRUMENTS, style.instruments.bass, random),
    timekeeper: chooseFromPool(TIMEKEEPER_INSTRUMENTS, style.instruments.timekeeper, random),
  }
  return { style, patterns, instruments }
}
