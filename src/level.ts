export type Duration = 'q' | '8' | 'h'
export type NoteSpec = { duration: Duration; rest?: boolean; dotted?: boolean; tie?: boolean }
export type RhythmToken = Duration | NoteSpec
export type Bar = RhythmToken[]
export type Level = { id: string; title: string; bpm: number; beatsPerBar: 4; rating: number; bars: Bar[] }
export type RhythmEvent = NoteSpec & { index: number; bar: number; beat: number; seconds: number; beats: number; attackIndex: number | null }
export type Onset = { index: number; bar: number; beat: number; seconds: number; duration: Duration; endSeconds: number; holdSeconds: number }

export function noteSpec(token: RhythmToken): NoteSpec {
  return typeof token === 'string' ? { duration: token } : token
}
export function noteBeats(token: RhythmToken): number {
  const note = noteSpec(token)
  return (note.duration === 'h' ? 2 : note.duration === 'q' ? 1 : 0.5) * (note.dotted ? 1.5 : 1)
}
export function parseLevel(value: unknown): Level {
  if (!value || typeof value !== 'object') throw new Error('Level must be an object')
  const level = value as Partial<Level>
  if (typeof level.id !== 'string' || !level.id.trim() || typeof level.title !== 'string' || !level.title.trim()) throw new Error('Level needs an id and title')
  if (level.bpm !== 110 || level.beatsPerBar !== 4 || !Number.isFinite(level.rating)) throw new Error(`Invalid tempo, time signature or rating: ${level.id}`)
  if (!Array.isArray(level.bars) || level.bars.length !== 8) throw new Error(`Level needs eight bars: ${level.id}`)
  let tied = false
  for (const bar of level.bars) {
    if (!Array.isArray(bar)) throw new Error(`Invalid bar: ${level.id}`)
    let beats = 0
    for (const token of bar) {
      if (!token || (typeof token !== 'string' && typeof token !== 'object')) throw new Error('Invalid rhythm token')
      const note = noteSpec(token)
      if (!['q', '8', 'h'].includes(note.duration) || ['rest', 'dotted', 'tie'].some((key) => key in note && typeof note[key as keyof NoteSpec] !== 'boolean')) throw new Error('Invalid note duration or modifier')
      if (note.rest && (tied || note.tie)) throw new Error('A tie cannot connect to a rest')
      tied = !!note.tie
      beats += noteBeats(token)
    }
    if (beats !== 4) throw new Error(`Each bar must contain four beats: ${level.id}`)
  }
  if (tied) throw new Error('A level cannot end with an unfinished tie')
  return level as Level
}
export function createEvents(level: Level): RhythmEvent[] {
  const events: RhythmEvent[] = []
  let attack = -1
  let tied = false
  level.bars.forEach((bar, barIndex) => {
    let beat = 0
    bar.forEach((token) => {
      const note = noteSpec(token)
      if (!note.rest && !tied) attack++
      events.push({ ...note, index: events.length, bar: barIndex, beat, seconds: (barIndex * level.beatsPerBar + beat) * 60 / level.bpm, beats: noteBeats(token), attackIndex: note.rest ? null : attack })
      beat += noteBeats(token)
      tied = !!note.tie
    })
  })
  return events
}
export function createOnsets(level: Level): Onset[] {
  const events = createEvents(level)
  const onsets: Onset[] = []
  events.forEach((event, index) => {
    if (event.rest || (index > 0 && events[index - 1].tie)) return
    let last = index
    while (events[last].tie) last++
    // In this game's hold gesture, release as the final tied note arrives.
    // Its written duration must not extend the strip to the next attack.
    const endSeconds = last > index ? events[last].seconds : event.seconds + event.beats * 60 / level.bpm
    onsets.push({ index: onsets.length, bar: event.bar, beat: event.beat, seconds: event.seconds, duration: event.duration, endSeconds, holdSeconds: last > index ? endSeconds - event.seconds : 0 })
  })
  return onsets
}
export function levelSeconds(level: Level) { return level.bars.length * level.beatsPerBar * 60 / level.bpm }
export const ATTEMPTS_PER_LEVEL = 2
export const SCROLL_PIXELS_PER_SECOND = 200
export function nextChallenge(current: { levelIndex: number; attempt: number }, passed: boolean, levelCount: number) {
  if (passed) return { levelIndex: (current.levelIndex + 1) % levelCount, attempt: 1 }
  if (current.attempt < ATTEMPTS_PER_LEVEL) return { ...current, attempt: current.attempt + 1 }
  return { levelIndex: Math.max(0, current.levelIndex - 1), attempt: 1 }
}
