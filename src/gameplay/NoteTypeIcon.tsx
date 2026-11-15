import { Cheese } from '../Cheese'
import type { Duration } from '../level'

export default function NoteTypeIcon({ duration, dotted, rest, tie }: { duration: Duration; dotted?: boolean; rest?: boolean; tie?: boolean }) {
  if (rest) return <svg className="preview-note-icon preview-rest" viewBox="0 0 40 48" aria-hidden="true">
    {duration === '8' ? <path d="M25 13c-3 10-7 20-12 30h-3l8-21c-8 4-13-3-9-7 4-5 9 0 7 3l7-6z" fill="currentColor" /> : duration === 'h' ? <path d="M9 24h22v5H9zM6 30h28v2H6z" fill="currentColor" /> : <path d="m15 3 12 12-8 9 9 10c-13-7-16-1-8 11C7 37 6 28 17 28l-7-7 9-9z" fill="currentColor" />}
  </svg>
  if (tie) return <span className="preview-tie" aria-hidden="true"><Cheese duration="8" /><i /><Cheese duration="q" /></span>
  return <span className="preview-note-icon" aria-hidden="true">
    <svg viewBox="0 0 40 48"><path d="M25 38V6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {duration === '8' && <path d="M25 6c0 8 14 8 6 20 3-10-6-10-6-14z" fill="currentColor" />}
      {dotted && <circle cx="35" cy="37" r="2" fill="currentColor" />}
    </svg><Cheese duration={duration} />
  </span>
}
