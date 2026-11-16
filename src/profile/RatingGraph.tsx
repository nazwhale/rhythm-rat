import { useId, useState } from 'react'
import type { RatingPoint } from '../ratings/onlineTypes'
const date = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
export default function RatingGraph({ points }: { points: RatingPoint[] }) {
  const titleId = useId(), descriptionId = useId()
  const [hovered, setHovered] = useState<number | null>(null)
  if (!points.length) return <p>Your rating graph will appear after your first rated run.</p>
  const [minimum, maximum] = points.reduce(([min, max], p) => [Math.min(min, p.rating), Math.max(max, p.rating)], [points[0].rating, points[0].rating])
  const low = Math.floor((minimum - 50) / 100) * 100
  const high = Math.ceil((maximum + 50) / 100) * 100
  const first = points[0], last = points[points.length - 1]
  const x = (at: number) => first.at === last.at ? 390 : 60 + (at - first.at) / (last.at - first.at) * 670
  const y = (rating: number) => 225 - (rating - low) / (high - low) * 190
  const selected = points[Math.min(hovered ?? points.length - 1, points.length - 1)]
  return <div className="rating-graph">
    <p className="graph-selection" aria-live="polite"><strong>{Math.round(selected.rating)}</strong> <span>{new Date(selected.at).toLocaleString()}</span></p>
    <svg viewBox="0 0 760 280" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
      <title id={titleId}>Glicko-2 rating over time</title>
      <desc id={descriptionId}>From {Math.round(first.rating)} on {date(first.at)} to {Math.round(last.rating)} on {date(last.at)}. Focus or hover over a point to inspect its rating.</desc>
      {[low, (low + high) / 2, high].map(value => <g key={value}><line x1="60" x2="730" y1={y(value)} y2={y(value)} className="graph-grid" /><text x="47" y={y(value) + 4} textAnchor="end">{Math.round(value)}</text></g>)}
      <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at)},${y(p.rating)}`).join(' ')} className="graph-line" />
      {points.map((p, i) => <circle key={p.id} cx={x(p.at)} cy={y(p.rating)} r={hovered === i ? 6 : 4} tabIndex={0}
        className="graph-point" aria-label={`${date(p.at)}: rating ${Math.round(p.rating)}`} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
        <title>{new Date(p.at).toLocaleString()} · {Math.round(p.rating)}</title>
      </circle>)}
      <text x="60" y="260">{date(first.at)}</text>
      {first.at !== last.at && <text x="730" y="260" textAnchor="end">{date(last.at)}</text>}
    </svg>
  </div>
}
