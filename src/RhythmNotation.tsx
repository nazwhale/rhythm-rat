import { useEffect, useRef } from 'react'
import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow'
import { SCROLL_PIXELS_PER_SECOND, createEvents, type Level } from './level'

export type Judgement = 'perfect' | 'good' | 'early' | 'late' | 'miss' | 'extra'
const EATEN_COLOR = '#c3cbc0'
const COLORS: Record<Judgement, string> = { perfect: EATEN_COLOR, good: EATEN_COLOR, early: EATEN_COLOR, late: EATEN_COLOR, miss: '#dc594d', extra: '#7d7185' }

// Match the reference's rhythm-only engraving: arches connect stem tips.
class StemTopTie extends StaveTie {
  getFirstX() { return (this.getNotes().firstNote as StaveNote).getStemX() }
  getLastX() { return (this.getNotes().lastNote as StaveNote).getStemX() }
  getFirstYs() { return [(this.getNotes().firstNote as StaveNote).getStemExtents().topY] }
  getLastYs() { return [(this.getNotes().lastNote as StaveNote).getStemExtents().topY] }
}

export function RhythmNotation({ marks, level }: { marks: Record<number, Judgement>; level: Level }) {
  const host = useRef<HTMLDivElement>(null)
  const pxPerSecond = SCROLL_PIXELS_PER_SECOND
  useEffect(() => {
    if (!host.current) return
    host.current.innerHTML = ''
    const barWidth = level.beatsPerBar * 60 / level.bpm * pxPerSecond
    const width = level.bars.length * barWidth + 160
    const renderer = new Renderer(host.current, Renderer.Backends.SVG)
    renderer.resize(width, 76)
    const context = renderer.getContext()
    context.setFont('Arial', 10)

    const events = createEvents(level)
    const rendered: StaveNote[] = []
    let noteIndex = 0
    level.bars.forEach((bar, barIndex) => {
      // Use an invisible stave only to position the rhythm glyphs.
      const x = barIndex === 0 ? 28 : 132 + barIndex * barWidth
      const stave = new Stave(x, -40, barWidth + (barIndex === 0 ? 104 : 0))
      stave.setContext(context)
      const notes = bar.map(() => {
        const event = events[noteIndex++]
        const duration = event.duration + (event.dotted ? 'd' : '') + (event.rest ? 'r' : '')
        const note = new StaveNote({ keys: [event.rest ? 'b/4' : 'c/4'], duration, stemDirection: 1 })
        if (event.dotted) Dot.buildAndAttach([note], { all: true })
        rendered.push(note)
        const result = event.attackIndex === null ? undefined : marks[event.attackIndex]
        if (event.rest) note.setStyle({ fillStyle: '#4d82a6', strokeStyle: '#4d82a6' })
        if (result) {
          const style = { fillStyle: COLORS[result], strokeStyle: COLORS[result] }
          note.setStyle(style)
          note.setStemStyle(style)
          note.setFlagStyle(style)
        }
        if (!event.rest) note.noteHeads.forEach((head) => head.setStyle({ fillStyle: 'transparent', strokeStyle: 'transparent' }))
        // Rhythm-only notation has no staff or ledger lines.
        note.setLedgerLineStyle({ strokeStyle: 'transparent', fillStyle: 'transparent' })
        return note
      })
      const beams = Beam.generateBeams(notes, { beamRests: false })
      const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false).addTickables(notes)
      new Formatter().joinVoices([voice]).format([voice], 385)
      // Place every note on the same musical clock used for scrolling and judging.
      notes.forEach((note, index) => {
        note.setStave(stave)
        const onset = events[noteIndex - notes.length + index]
        const tick = note.getTickContext()
        tick.setX(tick.getX() + 160 + onset.seconds * pxPerSecond - note.getAbsoluteX() - (note.isRest() ? 0 : note.getGlyphWidth() / 2))
      })
      voice.draw(context, stave)
      beams.forEach((beam) => {
        const eaten = beam.getNotes().every((note) => {
          const event = events[rendered.indexOf(note as StaveNote)]
          const result = event.attackIndex === null ? undefined : marks[event.attackIndex]
          return !!result && result !== 'miss' && result !== 'extra'
        })
        if (eaten) beam.setStyle({ fillStyle: EATEN_COLOR, strokeStyle: EATEN_COLOR })
        beam.setContext(context).drawWithStyle()
      })
    })
    events.forEach((event, index) => {
      if (event.tie) {
        const tie = new StemTopTie({ firstNote: rendered[index], lastNote: rendered[index + 1], firstIndexes: [0], lastIndexes: [0] })
        tie.setDirection(-1)
        tie.renderOptions.yShift = 3
        const result = event.attackIndex === null ? undefined : marks[event.attackIndex]
        if (result) tie.setStyle({ fillStyle: COLORS[result], strokeStyle: COLORS[result] })
        tie.setContext(context).drawWithStyle()
      }
    })
    const svg = host.current.querySelector('svg')
    if (svg) svg.style.display = 'block'
  }, [marks, level])

  return <div ref={host} className="cheese-notation" />
}
