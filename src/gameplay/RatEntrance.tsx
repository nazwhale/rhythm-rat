import type { ReactNode } from 'react'

export default function RatEntrance({ entering, progress, children }: { entering: boolean; progress: number; children: ReactNode }) {
  const arrival = Math.max(0, Math.min(1, progress))
  return <>
    <svg className={`entrance-hole ${entering ? 'is-open' : ''}`} viewBox="0 0 44 54" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#b5c1a8" d="M0 54V18h4V8h7V3h20v5h7v10h4v36z" />
      <path fill="#52634d" d="M4 54V20h4V12h7V8h12v4h7v8h4v34z" />
      <path fill="#2c3e30" d="M8 54V22h4v-8h18v8h4v32z" />
    </svg>
    {/* The audio clock drives arrival so the rat reaches the bite line on beat one,
        even when a frame is delayed; a separate CSS timer could drift out of sync. */}
    <div className="rat-approach" style={entering ? { transform: `translateX(calc(${1 - arrival} * (64px - 25%)))`, opacity: Math.min(1, arrival * 5) } : undefined}>{children}</div>
  </>
}
