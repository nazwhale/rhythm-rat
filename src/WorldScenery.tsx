import { memo, useMemo } from 'react'
import { SCROLL_PIXELS_PER_SECOND } from './level'
import { settlementForLevel, type Settlement } from './scenery'

const TILE_WIDTH = 960
const COPIES = [0, 1, 2, 3]

// Seeded scenery stays still while React updates the game clock.
function randomFor(seed: number) {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
}

function Tree({ x, y = 160 }: { x: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <path className="scenery-wood" d="M-3 0v-26h6V0z" />
    <path className="scenery-leaves" d="M-18-24v-18h8v-10h20v10h8v18H10v6h-20v-6z" />
    <path className="scenery-leaves-light" d="M-12-39h7v-8H6v8h-5v9h-13z" />
  </g>
}

function Windows({ width, height }: { width: number; height: number }) {
  return <path className="scenery-window" d={Array.from({ length: Math.max(1, Math.floor((height - 20) / 18)) }, (_, row) =>
    Array.from({ length: Math.max(1, Math.floor((width - 12) / 16)) }, (_, col) => `M${8 + col * 16} ${10 + row * 18}h6v8h-6z`).join(' ')
  ).join(' ')} />
}

function Skyline({ seed, settlement }: { seed: number; settlement: Settlement }) {
  const random = randomFor(seed)
  const count = settlement === 'village' ? 6 : settlement === 'town' ? 10 : 16
  return <svg viewBox="0 0 960 180" preserveAspectRatio="xMinYMax meet" shapeRendering="crispEdges">
    {settlement === 'village' && <path className="scenery-hill" d="M0 180v-38h40v-8h80v-8h80v8h80v14h120v-10h80v-14h100v10h80v12h120v-10h80v-8h100v52z" />}
    {Array.from({ length: count }, (_, index) => {
      const x = index * (960 / count) + 10 + Math.floor(random() * 12)
      const width = settlement === 'village' ? 66 : settlement === 'town' ? 65 : 42 + Math.floor(random() * 12)
      const height = settlement === 'village' ? 34 + Math.floor(random() * 14) : settlement === 'town' ? 58 + Math.floor(random() * 28) : 88 + Math.floor(random() * 67)
      const top = 180 - height
      return <g key={index}>
        {settlement === 'village' && <Tree x={x + 112} y={180} />}
        <g transform={`translate(${x} ${top})`}>
          <path className="scenery-building" d={`M0 0h${width}v${height}H0z`} />
          {settlement === 'village' ? <>
            <path className="scenery-roof" d={`M-6 0v-6h10v-8h12v-8h${width - 32}v8h12v8h10v6zM${width - 18} -14v-14h7v20z`} />
            <path className="scenery-window" d={`M10 10h10v10H10zm${width - 30} 0h10v10H${width - 20}z`} />
            <path className="scenery-wood" d={`M${width / 2 - 5} ${height - 20}h10v20h-10z`} />
          </> : <>
            <Windows width={width} height={height} />
            <path className="scenery-roof" d={`M-3-4h${width + 6}v5H-3z`} />
            {settlement === 'city' && <path className="scenery-roof" d={`M${width / 2 - 6}-4v-10h12v10zM${width / 2}-14v-12h2v12z`} />}
            {settlement === 'town' && index % 3 === 1 && <path className="scenery-awning" d={`M-3 ${height - 23}h${width + 6}v9H-3z`} />}
          </>}
        </g>
        {settlement === 'town' && index === 4 && <g transform={`translate(${x + 20} ${top - 38})`}>
          <path className="scenery-roof" d="M0 38V8h6V0h16v8h6v30z" />
          <path className="scenery-window" d="M7 12h14v14H7z" />
          <path className="scenery-wood" d="M13 14h2v7h5v2h-7z" />
        </g>}
      </g>
    })}
  </svg>
}

function Street({ seed, settlement }: { seed: number; settlement: Settlement }) {
  const random = randomFor(seed)
  return <svg viewBox="0 0 960 150" preserveAspectRatio="xMinYMax meet" shapeRendering="crispEdges">
    <path fill="currentColor" d="M0 149h960v1H0z" />
    {Array.from({ length: 3 }, (_, index) => {
      const x = index * 320 + 24 + Math.floor(random() * 65)
      const cat = random() > .5
      return <g key={index} transform={`translate(${x} 0)`} fill="currentColor">
        {settlement === 'village' ? <>
          <Tree x={12} y={149} />
          <path className="scenery-wood" d="M38 149v-24h5v24zm19 0v-24h5v24zm19 0v-24h5v24zm19 0v-24h5v24zM38 130h62v4H38zm0 10h62v4H38z" />
          <path className="scenery-leaves" d="M118 149v-9h7v-6h15v6h7v9zM-16 149v-5h5v-5h8v10z" />
        </> : settlement === 'town' ? <>
          <path className="scenery-building" d="M0 149V85h82v64z" />
          <path className="scenery-roof" d="M-4 81h90v5H-4z" />
          <path className="scenery-awning" d="M-4 102h90v11H-4z" />
          <path className="scenery-window" d="M8 117h24v20H8zm34 0h18v32H42zM17 90h48v5H17z" />
          <path className="scenery-window" opacity=".55" d="M4 102h8v11H4zm16 0h8v11h-8zm16 0h8v11h-8zm16 0h8v11h-8zm16 0h8v11h-8z" />
          <Tree x={124} y={149} />
        </> : <>
          <path className="scenery-building" d="M0 149V61h70v88z" />
          <path className="scenery-roof" d="M-3 57h76v5H-3zM53 65h3v70h-3zM28 88h32v3H28zm0 23h32v3H28zM30 89h3v22h-3z" />
          <path className="scenery-window" d="M8 70h10v12H8zm20 0h10v12H28zM8 93h10v12H8zm20 0h10v12H28zM8 116h10v12H8zm20 0h10v12H28zM43 130h17v19H43z" />
          <path className="scenery-awning" d="M78 107h23v17H78zM87 124h4v25h-4z" />
          <path d="M117 149v-19h29v19h-3v-16h-23v16zm-2-25h33v4h-33z" />
        </>}
        {cat && <g className="scenery-cat" transform="translate(164 130)">
          <path d="M0 20v-7h2V8h2V0l5 4h3l5-4v8h2v12h-6v-5h-2v5zM17 19h7v-3h3v-8h-3v6h-3v2h-4z" />
        </g>}
      </g>
    })}
  </svg>
}

/** Decorative only: scenery shares the run clock without affecting timing or input. */
export default memo(function WorldScenery({ elapsed, running, seed, levelIndex, levelCount }: { elapsed: number; running: boolean; seed: number; levelIndex: number; levelCount: number }) {
  const settlement = settlementForLevel(levelIndex, levelCount)
  const tiles = useMemo(() => ({
    skyline: COPIES.map((tile) => <div className="scenery-tile" key={tile}><Skyline seed={seed + tile * 107} settlement={settlement} /></div>),
    street: COPIES.map((tile) => <div className="scenery-tile" key={tile}><Street seed={seed + tile * 293} settlement={settlement} /></div>),
  }), [seed, settlement])
  const distance = Math.max(0, elapsed) * SCROLL_PIXELS_PER_SECOND
  return <div className={`world-scenery scenery-${settlement} ${running ? 'is-running' : ''}`} aria-hidden="true">
    <div className="scenery-layer scenery-skyline" style={{ transform: `translateX(${-distance * .13 % TILE_WIDTH}px)` }}>
      {tiles.skyline}
    </div>
    <div className="scenery-layer scenery-street" style={{ transform: `translateX(${-distance * .38 % (TILE_WIDTH * 2)}px)` }}>
      {tiles.street}
    </div>
  </div>
})
