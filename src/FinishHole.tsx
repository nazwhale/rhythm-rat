import { useMemo, type CSSProperties } from 'react'
import { chooseDiscoSurprises, PartyMouse } from './discoSurprises'

const PALETTES = [ ['#f4bded', '#8ce8dc', '#ffe28b'], ['#bca7ff', '#ffb795', '#a8edb3'], ['#89d9ff', '#f5a8cb', '#f6eaa0'] ]

export default function FinishHole({ tier, celebrating, perfect, seed, left }: { tier: number; celebrating: boolean; perfect: boolean; seed: number; left: number }) {
  // Stable for the whole run, including renders caused by individual bites.
  const party = useMemo(() => {
    let state = seed >>> 0
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
    const colors = PALETTES[Math.floor(random() * PALETTES.length)]
    return { colors, dancers: Array.from({ length: 3 + Math.min(tier, 3) }, (_, i) => ({ x: 23 + i % 3 * 21, y: i < 3 ? 78 : 59, delay: random() * .4, speed: .3 + random() * .25 })), confetti: Array.from({ length: 32 }, (_, i) => ({ x: (random() - .5) * 250, y: -45 - random() * 95, delay: random() * .7, color: colors[i % 3], turn: random() * 540 })) }
  }, [seed, tier])
  const surprises = useMemo(() => chooseDiscoSurprises(seed), [seed])
  const surpriseDescription = surprises.map(surprise => surprise.description).join('. ')
  const style = { left, '--party-a': party.colors[0], '--party-b': party.colors[1], '--party-c': party.colors[2] } as CSSProperties
  return <div className={`finish-hole ${celebrating ? 'celebrating' : ''} ${perfect ? 'perfect-party' : ''}`} style={style} role="img" aria-label={celebrating ? `${perfect ? 'Perfect run! Golden encore. ' : ''}Rat enters a disco inside the wall. ${surpriseDescription}` : 'A mouse hole waiting for the party'}>
    {celebrating && <div className="disco-cutaway" role="img" aria-label={`Inside the wall: a mouse disco. ${surpriseDescription}`}>
      <svg viewBox="0 0 640 200" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <path fill="#b5bba5" d="M0 200V66h12V40h26V23h83V12h190v8h122V8h143v18h48v22h16v152z"/>
        <path fill="#40394e" d="M10 200V70h12V48h24V33h77V22h184v8h130V18h135v18h42v20h16v144z"/>
        <path fill="#63516b" d="M24 175V61h100V35h180v9h134V31h129v18h47v126z"/>
        <path stroke="#8e7486" strokeWidth="3" d="M125 36v136M306 45v128M440 32v141M28 86h584"/>
        <g className="club-beams" opacity=".22"><path fill={party.colors[0]} d="m290 45-145 132h145z"/><path fill={party.colors[1]} d="m290 45 45 132h160z"/></g>
        <path fill="#9a7a79" d="M10 175h620v25H10z"/><path stroke="#6c5968" strokeWidth="2" d="M12 186h616M100 175v11m110 0v14m105-25v11m105 0v14m105-25v11"/>
        <g fill={party.colors[2]}>{Array.from({ length: 12 }, (_, i) => <rect key={i} x={160 + i * 27} y={179 + i % 2 * 11} width="25" height="9" opacity=".45"/>)}</g>
        <path d="M48 54q240 54 535-8" stroke="#c2a594" fill="none" strokeWidth="2"/>
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={50 + i * 47} y={56 + Math.sin(i / 11 * Math.PI) * 24 - i} width="5" height="8" fill={party.colors[i % 3]}/>)}
        <path stroke="#a9aaa7" strokeWidth="2" d="M290 35v12"/>
        <g className="club-mirror-ball"><circle cx="290" cy="61" r="16" fill="#b8d6db"/><path stroke="#6d8b9c" strokeWidth="2" fill="none" d="M275 55h30m-30 10h30m-16-19v30m-8-28v24m17-24v24"/><path fill="#fff5cd" d="M280 50h6v5h-6zm13 12h6v5h-6z"/></g>
        <g transform="translate(39 134)"><path fill="#93b3ac" d="M0 0h67v14H0z"/><path fill="#c7d7c6" d="M5 3h57v5H5z"/><path fill="#8c737f" d="M6 14h55v27H6z"/><PartyMouse x={20} y={0}/><circle cx="20" cy="7" r="6" fill="#454654"/><circle cx="49" cy="7" r="6" fill="#454654"/></g>
        {[130].map(x => <g key={x} transform={`translate(${x} 117)`}><path fill="#a3aaa3" d="M0 0h25v54H0z"/>{[10, 24, 38].map(y => <path key={y} d={`M5 ${y}h15`} stroke="#566666" strokeWidth="4"/>)}</g>)}
        {[185, 232].map((x, i) => <g key={x} transform={`translate(${x} ${162 + i % 2 * 9})`}><g className="club-guest" style={{ animationDelay: `${i * -.17}s` }}><PartyMouse color={party.colors[i % 3]}/></g></g>)}
        <g className="club-arriving-rat"><PartyMouse x={72} y={178} color="#929b9e"/></g>
        {surprises.map((surprise, index) => {
          const SurpriseScene = surprise.Scene
          return <svg key={surprise.id} x={282 + index * 177} y={17} width="150" height="160" viewBox="0 0 150 160" overflow="hidden">
            <g className={`club-surprise surprise-${surprise.id}`}><SurpriseScene/></g>
          </svg>
        })}
      </svg>
    </div>}
    <svg viewBox="0 0 96 96" shapeRendering="crispEdges" aria-hidden="true">
      <defs><clipPath id="party-door"><path d="M12 96V42h6V24h12V12h36v12h12v18h6v54z" /></clipPath></defs>
      <path className="party-rim" fill="#c1c9b8" d="M6 96V42h6V24h12V12h12V6h24v6h12v12h12v18h6v54z" />
      <path fill="#2c3c33" d="M12 96V42h6V24h12V12h36v12h12v18h6v54z" />
      <g clipPath="url(#party-door)" className="party-interior">
        <path className="party-wash" fill="#544768" d="M12 12h72v84H12z" />
        <g className="party-beams" opacity=".4"><path fill={party.colors[0]} d="M48 28 8 96h30z" /><path fill={party.colors[1]} d="m48 28 10 68h30z" /></g>
        <path fill="#708080" d="M12 87h72v9H12z" />
        <path fill={party.colors[2]} opacity=".5" d="M15 88h12v4H15zm27 0h12v4H42zm27 0h12v4H69zM28 93h12v3H28zm27 0h12v3H55z" />
        <path stroke="#9eafac" strokeWidth="2" d="M48 12v9" />
        <g className="party-ball"><path fill="#bbcdd0" d="M39 22h18v4h4v13h-4v4H39v-4h-4V26h4z" /><path fill="#fffbe0" d="M40 24h5v5h-5zm9 8h5v5h-5z" /><path fill={party.colors[0]} d="M49 24h5v5h-5zm-9 9h5v5h-5z" /></g>
        {party.dancers.map((dancer, i) => <g key={i} transform={`translate(${dancer.x} ${dancer.y})`}><g className="party-dancer" style={{ '--dance-delay': `${dancer.delay}s`, '--dance-speed': `${dancer.speed}s` } as CSSProperties}>
          <path fill={i % 2 ? '#c6b7a8' : '#9ca69b'} d="M-8 0v-10h4v-6h6v6h7v4h5v6H-8zm2 0h4v5h-4zm10 0h4v5H4z" />
          <path fill="#e7b1a0" d="M-3-15h4v4h-4z" /><path fill="#fff" d="M7-8h3v3H7z" />
          <path fill={party.colors[i % 3]} d="m-7-17 4-9 5 9z" />
        </g></g>)}
        <path className="party-bulbs" fill={party.colors[2]} d="M18 26h5v5h-5zm12-9h5v5h-5zm31 0h5v5h-5zm12 9h5v5h-5z" />
      </g>
      {celebrating && perfect && <path className="party-crown" fill="#f3cf61" stroke="#a98639" d="m31 5-3-15 12 7 8-13 8 13 12-7-3 15z" />}
    </svg>
    {celebrating && <>
      {perfect && <span className="party-caption">PERFECT! ENCORE!</span>}
      <span className="party-burst" aria-hidden="true">{party.confetti.slice(0, perfect ? 32 : 16).map((piece, i) => <i key={i} style={{ '--x': `${piece.x}px`, '--y': `${piece.y}px`, '--turn': `${piece.turn}deg`, '--delay': `${piece.delay}s`, background: perfect && i % 2 === 0 ? '#f3cf61' : piece.color } as CSSProperties} />)}</span>
    </>}
  </div>
}
