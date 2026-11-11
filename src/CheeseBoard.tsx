import { Cheese } from './Cheese'
import type { Duration } from './level'

function CheeseNote({ duration, dotted = false }: { duration: Duration; dotted?: boolean }) {
  return <span className="board-note" aria-hidden="true">
    <svg viewBox="0 0 40 56">
      <path d="M24 44V9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {duration === '8' && <path d="M24 9c0 8 13 8 6 19 3-10-6-9-6-14z" fill="currentColor" />}
      {dotted && <circle cx="35" cy="43" r="2" fill="currentColor" />}
    </svg>
    <Cheese duration={duration} />
  </span>
}

export default function CheeseBoard() {
  return <section className="cheese-board" aria-labelledby="cheese-board-title">
    <div className="cheese-board-heading"><h2 id="cheese-board-title">The cheese board</h2><span>A LITTLE RHYTHM KEY</span></div>
    <dl className="cheese-key">
      <div><CheeseNote duration="q" /><dt>Crotchet <span>(quarter note)</span></dt><dd>Yellow wedge · 1 beat</dd></div>
      <div><CheeseNote duration="8" /><dt>Quaver <span>(eighth note)</span></dt><dd>Cheese wheel · ½ beat</dd></div>
      <div><CheeseNote duration="q" dotted /><dt>Dotted crotchet <span>(dotted quarter)</span></dt><dd>Wedge + dot · 1½ beats</dd></div>
      <div><CheeseNote duration="h" /><dt>Minim <span>(half note)</span></dt><dd>Red-wax Edam · 2 beats</dd></div>
      <div><svg className="board-rest" viewBox="0 0 32 44" aria-hidden="true"><path fill="currentColor" d="M11 2 22 13 15 21 23 30C12 24 9 30 16 40 5 33 5 25 13 25L7 19l8-8z" /></svg><dt>Rest <span>(silence)</span></dt><dd>Blue symbol · don’t press</dd></div>
      <div><span className="board-tie" aria-hidden="true"><Cheese duration="8" /><i/><Cheese duration="q" /></span><dt>Tied notes <span>(hold)</span></dt><dd>Hold the strip until the tied-to note arrives</dd></div>
    </dl>
  </section>
}
