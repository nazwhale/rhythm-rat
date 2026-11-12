import { memo, useMemo } from 'react'
import { SCROLL_PIXELS_PER_SECOND } from './level'

const TILE_WIDTH = 960
const COPIES = [0, 1, 2, 3]

// Seeded scenery stays still while React updates the game clock.
function randomFor(seed: number) {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
}

function Skyline({ seed }: { seed: number }) {
  const random = randomFor(seed)
  return <svg viewBox="0 0 960 160" preserveAspectRatio="none">
    {Array.from({ length: 16 }, (_, index) => {
      const x = index * 60
      const height = 40 + Math.floor(random() * 65)
      const width = 38 + Math.floor(random() * 22)
      return <g key={index}>
        <path fill="currentColor" d={`M${x} 160v-${height}h${width}v${height}zM${x + 8} ${160 - height}v-8h${width - 16}v8z`} />
        <path fill="#fbfcf8" opacity=".5" d={`M${x + 10} ${174 - height}h5v9h-5zM${x + 24} ${174 - height}h5v9h-5z`} />
      </g>
    })}
  </svg>
}

function Street({ seed }: { seed: number }) {
  const random = randomFor(seed)
  return <svg viewBox="0 0 960 150" preserveAspectRatio="xMidYMax meet" shapeRendering="crispEdges">
    <path fill="currentColor" d="M0 149h960v1H0z" />
    {Array.from({ length: 3 }, (_, index) => {
      const x = index * 320 + 30 + Math.floor(random() * 190)
      const cat = random() > .5
      return <g key={index} transform={`translate(${x} 0)`} fill="currentColor">
        <path d="M0 149v-27h48v27h-3v-24H3v24zm5-32h39v3H5zm7 10h3v19h-3zm20 0h3v19h-3z" />
        {cat && <g className="scenery-cat" transform="translate(56 130)">
          <path d="M0 20v-7h2V8h2V0l5 4h3l5-4v8h2v12h-6v-5h-2v5zM17 19h7v-3h3v-8h-3v6h-3v2h-4z" />
        </g>}
      </g>
    })}
  </svg>
}

/** Decorative only: scenery shares the run clock without affecting timing or input. */
export default memo(function WorldScenery({ elapsed, running, seed }: { elapsed: number; running: boolean; seed: number }) {
  const tiles = useMemo(() => ({
    skyline: COPIES.map((tile) => <div className="scenery-tile" key={tile}><Skyline seed={seed + tile * 107} /></div>),
    street: COPIES.map((tile) => <div className="scenery-tile" key={tile}><Street seed={seed + tile * 293} /></div>),
  }), [seed])
  const distance = Math.max(0, elapsed) * SCROLL_PIXELS_PER_SECOND
  return <div className={`world-scenery ${running ? 'is-running' : ''}`} aria-hidden="true">
    <div className="scenery-layer scenery-skyline" style={{ transform: `translateX(${-distance * .13 % TILE_WIDTH}px)` }}>
      {tiles.skyline}
    </div>
    <div className="scenery-layer scenery-street" style={{ transform: `translateX(${-distance * .38 % (TILE_WIDTH * 2)}px)` }}>
      {tiles.street}
    </div>
  </div>
})
