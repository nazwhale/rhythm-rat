import { noteSpec, type Level } from '../level.ts'
// Fixed field ordering and normalized tokens make versions independent of JSON key order.
export function puzzleContent(level: Level) {
  return JSON.stringify({ id: level.id, bpm: level.bpm, beatsPerBar: level.beatsPerBar,
    bars: level.bars.map(bar => bar.map(token => {
      const n = noteSpec(token)
      return { duration: n.duration, rest: !!n.rest, dotted: !!n.dotted, tie: !!n.tie }
    })) })
}
