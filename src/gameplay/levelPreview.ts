import { noteSpec, type Duration, type Level } from '../level.ts'

export type PreviewNoteType = { id: string; label: string; detail: string; duration: Duration; dotted?: boolean; rest?: boolean; tie?: boolean }
const NAMES: Record<Duration, string> = { h: 'Half note', q: 'Quarter note', '8': 'Eighth note' }
const BEATS: Record<Duration, number> = { h: 2, q: 1, '8': .5 }

export function getLevelNoteTypes(level: Level): PreviewNoteType[] {
  const types = new Map<string, PreviewNoteType>()
  // Read written tokens, not just attacks: tie targets and rests also need explaining.
  for (const token of level.bars.flat()) {
    const note = noteSpec(token)
    const id = `${note.rest ? 'rest-' : ''}${note.duration}${note.dotted ? '-dotted' : ''}`
    const beats = BEATS[note.duration] * (note.dotted ? 1.5 : 1)
    types.set(id, { id, duration: note.duration, dotted: note.dotted, rest: note.rest,
      label: `${note.dotted ? 'Dotted ' : ''}${note.rest ? NAMES[note.duration].replace(' note', ' rest').toLowerCase() : NAMES[note.duration].toLowerCase()}`,
      detail: note.rest ? 'Don’t tap' : `${beats} ${beats === 1 ? 'beat' : 'beats'}` })
    if (note.tie) types.set('tie', { id: 'tie', label: 'Tied notes', detail: 'Hold, then release', duration: 'q', tie: true })
  }
  return [...types.values()]
}

