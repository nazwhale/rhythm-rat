import { memo, useMemo } from 'react'
import { SCROLL_PIXELS_PER_SECOND } from './level'
import { sceneryForLevel, sceneryScroll, settlementAt, type SceneryLayer } from './scenery'

const COPIES = [0, 1, 0, 1]

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

function Skyline({ seed, profile }: { seed: number; profile: SceneryLayer }) {
  const random = randomFor(seed)
  const count = profile.density
  return <svg viewBox="0 0 960 180" preserveAspectRatio="xMinYMax meet" shapeRendering="crispEdges">
    {profile.urbanity < .65 && <path className="scenery-hill" d="M0 180v-38h40v-8h80v-8h80v8h80v14h120v-10h80v-14h100v10h80v12h120v-10h80v-8h100v52z" />}
    {Array.from({ length: count }, (_, index) => {
      const x = Math.floor(index * (960 / count)) + 10 + Math.floor(random() * 12)
      const settlement = settlementAt(Math.max(0, Math.min(1, profile.urbanity + (random() - .5) * .4)))
      const width = settlement === 'village' ? 66 : settlement === 'town' ? 65 : 42 + Math.floor(random() * 12)
      const height = Math.floor(28 + profile.urbanity * 83 + random() * (16 + profile.urbanity * 35))
      const top = 180 - height
      return <g key={index}>
        {profile.urbanity < .75 && index % (1 + Math.floor(profile.urbanity * 4)) === 0 && <Tree x={x + 100} y={180} />}
        {settlement === 'village' && index === 1 && profile.variant % 2 === 0 && <g className="scenery-wood" transform={`translate(${x + 82} 180)`}>
          <path d="M0 0l5-58h8l5 58zM-12-44h42v4h-42zM7-64h4v44H7z" fill="currentColor" />
          <path className="scenery-roof" d="M-14-47h17v7h-17zm27 3h19v7H13zM4-66h7v17H4zm4 25h7v18H8z" />
        </g>}
        <g transform={`translate(${x} ${top})`}>
          <path className="scenery-building" d={`M0 0h${width}v${height}H0z`} />
          {settlement === 'village' ? <>
            <path className="scenery-roof" d={`M-6 0v-6h10v-8h12v-8h${width - 32}v8h12v8h10v6zM${width - 18} -14v-14h7v20z`} />
            <path className="scenery-window" d={`M10 10h10v10H10zm${width - 30} 0h10v10H${width - 20}z`} />
            <path className="scenery-wood" d={`M${width / 2 - 5} ${height - 20}h10v20h-10z`} />
          </> : <>
            <Windows width={width} height={height} />
            <path className="scenery-roof" d={`M-3-4h${width + 6}v5H-3z`} />
            {settlement === 'city' && <path className="scenery-roof" d={profile.variant % 2 === 0
              ? `M${width / 2 - 6}-4v-10h12v10zM${width / 2}-14v-12h2v12z`
              : `M8-4v-12h20v12zM10-16v-4h16v4zM10-4v5h3v-5zm13 0v5h3v-5z`} />}
            {settlement === 'town' && index % 3 === 1 && <path className="scenery-awning" d={`M-3 ${height - 23}h${width + 6}v9H-3z`} />}
          </>}
        </g>
        {settlement === 'town' && index === 2 + profile.variant && <g transform={`translate(${x + 20} ${top - 38})`}>
          <path className="scenery-roof" d="M0 38V8h6V0h16v8h6v30z" />
          <path className="scenery-window" d="M7 12h14v14H7z" />
          <path className="scenery-wood" d="M13 14h2v7h5v2h-7z" />
        </g>}
      </g>
    })}
  </svg>
}

function Street({ seed, profile }: { seed: number; profile: SceneryLayer }) {
  const random = randomFor(seed)
  return <svg viewBox="0 0 960 150" preserveAspectRatio="xMinYMax meet" shapeRendering="crispEdges">
    <path fill="currentColor" d="M0 149h960v1H0z" />
    {Array.from({ length: profile.density }, (_, index) => {
      const x = Math.floor(index * 960 / profile.density) + 24 + Math.floor(random() * 30)
      const settlement = settlementAt(Math.max(0, Math.min(1, profile.urbanity + (random() - .5) * .35)))
      const cat = random() > .5
      return <g key={index} transform={`translate(${x} 0)`} fill="currentColor">
        {settlement === 'village' ? <>
          {profile.variant === 0 ? <g className="scenery-leaves">
            <path d="M-8 149v-9h5v-13h4v13h6v9zm22 0v-9h5v-13h4v13h6v9zm22 0v-9h5v-13h4v13h6v9z" />
            <path className="scenery-awning" d="M-5 129h6v5h-6zm22 0h6v5h-6zm22 0h6v5h-6z" />
          </g> : <Tree x={12} y={149} />}
          {profile.variant === 2 && <g transform="translate(103 149)">
            <path className="scenery-building" d="M0 0v-28h32V0z" />
            <path className="scenery-roof" d="M-4-28v-6h8v-6h16v6h16v6z" />
            <path className="scenery-wood" d="M10 0v-18h12V0z" />
          </g>}
          <path className="scenery-wood" d="M38 149v-24h5v24zm19 0v-24h5v24zm19 0v-24h5v24zm19 0v-24h5v24zM38 130h62v4H38zm0 10h62v4H38z" />
          <path className="scenery-leaves" d="M118 149v-9h7v-6h15v6h7v9zM-16 149v-5h5v-5h8v10z" />
        </> : settlement === 'town' ? <>
          <path className="scenery-building" d="M0 149V85h82v64z" />
          <path className="scenery-roof" d="M-4 81h90v5H-4z" />
          <path className="scenery-awning" d="M-4 102h90v11H-4z" />
          <path className="scenery-window" d="M8 117h24v20H8zm34 0h18v32H42zM17 90h48v5H17z" />
          <path className="scenery-window" opacity=".55" d="M4 102h8v11H4zm16 0h8v11h-8zm16 0h8v11h-8zm16 0h8v11h-8zm16 0h8v11h-8z" />
          {profile.variant % 2 === 0 ? <Tree x={124} y={149} /> : <g transform="translate(108 149)">
            <path className="scenery-wood" d="M0 0v-19h40V0h-4v-15H4V0zM-2-25h44v5H-2z" />
            <path className="scenery-leaves" d="M7-25v-9h6v-5h14v5h6v9z" />
          </g>}
        </> : <>
          <path className="scenery-building" d="M0 149V61h70v88z" />
          <path className="scenery-roof" d="M-3 57h76v5H-3zM53 65h3v70h-3zM28 88h32v3H28zm0 23h32v3H28zM30 89h3v22h-3z" />
          <path className="scenery-window" d="M8 70h10v12H8zm20 0h10v12H28zM8 93h10v12H8zm20 0h10v12H28zM8 116h10v12H8zm20 0h10v12H28zM43 130h17v19H43z" />
          {profile.variant % 2 === 0 ? <path className="scenery-awning" d="M78 107h23v17H78zM87 124h4v25h-4z" /> : <g transform="translate(78 149)">
            <path className="scenery-roof" d="M0 0v-43h26V0z" />
            <path className="scenery-window" d="M4-38h18v22H4z" />
            <path className="scenery-awning" d="M4-10h18v4H4z" />
          </g>}
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
  const profiles = useMemo(() => sceneryForLevel(levelIndex, levelCount), [levelIndex, levelCount])
  const tiles = useMemo(() => ({
    skyline: COPIES.map((tile, copy) => <div className="scenery-tile" key={copy}><Skyline seed={seed + tile * 107} profile={profiles.skyline} /></div>),
    street: COPIES.map((tile, copy) => <div className="scenery-tile" key={copy}><Street seed={seed + tile * 293} profile={profiles.street} /></div>),
  }), [seed, profiles])
  const distance = Math.max(0, elapsed) * SCROLL_PIXELS_PER_SECOND
  return <div className={`world-scenery ${running ? 'is-running' : ''}`} aria-hidden="true">
    <div className={`scenery-layer scenery-skyline scenery-${profiles.skyline.settlement}`} data-urbanity={profiles.skyline.urbanity} style={{ transform: `translateX(${sceneryScroll(distance, .13, profiles.skyline.offset)}px)` }}>
      {tiles.skyline}
    </div>
    <div className={`scenery-layer scenery-street scenery-${profiles.street.settlement}`} data-urbanity={profiles.street.urbanity} style={{ transform: `translateX(${sceneryScroll(distance, .38, profiles.street.offset)}px)` }}>
      {tiles.street}
    </div>
  </div>
})
