import type { ComponentType } from 'react'

export function PartyMouse({ x = 0, y = 0, color = '#b9b3c2' }: { x?: number; y?: number; color?: string }) {
  return <g transform={`translate(${x} ${y})`}><path fill={color} d="M0 0v-11h5v-8h7v8h10v5h7v6H0zM3 0h5v5H3zm16 0h5v5h-5z" /><path fill="#e6aba9" d="M6-17h5v5H6zM-8-3H0v3h-8z" /><path fill="#252d38" d="M22-9h3v3h-3z" /></g>
}

function CheeseDelivery() { return <g className="surprise-arrival"><PartyMouse x={12} y={146}/><circle cx="66" cy="132" r="23" fill="#f4ce70"/><path fill="#bf9451" d="M54 121h7v6h-7zm16 15h8v7h-8zm-19 6h5v5h-5z"/></g> }
function CongaLine() { return <g className="surprise-conga">{[0, 1, 2, 3].map(i => <PartyMouse key={i} x={i * 36} y={138} color={i % 2 ? '#d7b99c' : '#a6c7b6'}/>)}</g> }
function Breakdancer() { return <g transform="translate(72 130)"><ellipse cy="16" rx="47" ry="9" fill="#b496bd"/><g className="surprise-spin"><PartyMouse x={-14}/></g></g> }
function SleepingGuest() { return <g><path fill="#a38593" d="M17 144v-27h75v27z"/><PartyMouse x={42} y={121}/><g className="surprise-snooze" fill="#d8cee6"><text x="67" y="91" fontSize="17">z</text><text x="83" y="73" fontSize="23">z</text></g></g> }
function SpoonSlide() { return <g><path d="M18 54q45 3 59 49t57 27" fill="none" stroke="#a8bcc6" strokeWidth="12"/><path d="M28 59v87m69-19v19" stroke="#748c92" strokeWidth="5"/><g className="surprise-slide"><PartyMouse x={5} y={52}/></g></g> }
function CatWindow() { return <g><path fill="#9a7a9d" d="M20 38h106v76H20z"/><path fill="#253443" d="M26 44h94v64H26z"/><g className="surprise-cat"><path fill="#bfd48b" d="M37 76q30-35 65 0-33 30-65 0"/><path stroke="#303b34" strokeWidth="7" d="M70 60v30"/></g><path className="surprise-curtain" fill="#c995ae" d="M26 44h94v64H26z"/></g> }
function BalloonLift() { return <g className="surprise-float"><path stroke="#e7d9b3" fill="none" d="M35 58 65 116 95 57M66 53v63"/>{[35, 66, 95].map((x, i) => <ellipse key={x} cx={x} cy={43 - i % 2 * 13} rx="16" ry="22" fill={['#f2bdca', '#e7ce81', '#a5d8d0'][i]}/>)}<PartyMouse x={54} y={134}/></g> }
function TinyBand() { return <g><PartyMouse x={16} y={129}/><PartyMouse x={78} y={129} color="#c6b099"/><g className="surprise-band"><path stroke="#e6cc85" strokeWidth="8" fill="none" d="m35 99 15 15-13 14m53-30v30"/><circle cx="91" cy="124" r="12" fill="#d395a4"/><path stroke="#f1dca9" strokeWidth="3" d="m68 103 15 12"/></g></g> }
function ConfettiCannon() { return <g><path fill="#bd96ba" d="m38 145 20-47 27 26z"/><path fill="#ebce80" d="m58 98 27 26-5 7-27-26z"/>{Array.from({ length: 12 }, (_, i) => <rect className="surprise-spark" key={i} x={25 + i * 9} y={30 + i % 4 * 13} width="5" height="8" fill={i % 2 ? '#a4ddd1' : '#f0ce84'} style={{ animationDelay: `${i * .09}s` }}/> )}</g> }
function CheeseToast() { return <g><PartyMouse x={21} y={141}/><PartyMouse x={89} y={141} color="#a5c5b8"/><g className="surprise-toast"><path stroke="#d5d9d2" strokeWidth="3" d="M56 103v20m-8 0h16m27-20v20m-8 0h16"/><path fill="#f1ce76" d="M46 86h20v17H46zm35 0h20v17H81z"/><path fill="#fff0b9" d="m67 72 6-8 6 8-6 8z"/></g></g> }

function LimboContest() { return <g><path stroke="#d3b985" strokeWidth="5" d="M15 149V82h119v67"/><path stroke="#f0b6ce" strokeWidth="5" d="M15 91h119"/><g className="surprise-limbo"><PartyMouse x={58} y={128}/></g></g> }
function CheeseJuggler() { return <g><PartyMouse x={60} y={145}/>{[0, 1, 2].map(i => <g key={i} transform={`translate(${35 + i * 37} ${70 - i % 2 * 25})`}><path className="surprise-juggle" style={{ animationDelay: `${i * -.4}s` }} fill="#f1cf79" d="m-9 7 6-19 14 19z"/></g>)}</g> }
function RollerSkater() { return <g><path stroke="#8d799e" strokeWidth="2" d="M12 148h126"/><g className="surprise-skate"><PartyMouse x={53} y={130}/><path fill="#efa9c4" d="M54 134h13v5H54zm17 0h13v5H71z"/>{[57, 64, 74, 81].map(x => <circle key={x} cx={x} cy="142" r="3" fill="#e8cf8c"/>)}</g></g> }
function BubbleMachine() { return <g><path fill="#a6c4bc" d="M25 144v-30h48v30z"/><circle cx="49" cy="113" r="13" fill="#8d8ca9"/><circle cx="49" cy="113" r="7" fill="#45465b"/>{[0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(${46 + i * 18} ${89 - i % 3 * 19})`}><g className="surprise-bubble" style={{ animationDelay: `${i * -.5}s` }}><circle r={6 + i % 3 * 2} stroke="#afe5e5" strokeWidth="2" fill="#d9c8ed" fillOpacity=".18"/><path stroke="#fff5dc" d="m-3-3 3-2"/></g></g>)}</g> }
function PhotoBooth() { return <g><path fill="#b28ea9" d="M21 145V40h111v105z"/><path fill="#40394e" d="M29 57h95v80H29z"/><path fill="#e4bf86" d="M36 45h79v6H36z"/><PartyMouse x={44} y={117}/><PartyMouse x={82} y={117} color="#b9cfac"/><path fill="#efaec4" d="m45 96 5-16 11 16z"/><path fill="#bbdaea" d="M84 98h22v6H84z"/><rect className="surprise-flash" x="29" y="57" width="95" height="80" fill="#fff8dc"/></g> }
function SockHammock() { return <g><path stroke="#b6a58c" strokeWidth="3" d="M12 49v99m126-99v99"/><g className="surprise-hammock"><path d="M12 62q58 100 126 0" fill="#b2c7b4" stroke="#d5ddad" strokeWidth="7"/><PartyMouse x={60} y={95}/><path fill="#e9b8c5" d="M34 90h12v10H34zm57-2h12v10H91z"/></g></g> }
function TapDancer() { return <g><ellipse cx="76" cy="147" rx="54" ry="9" fill="#a48ba9"/><g className="surprise-tap"><PartyMouse x={59} y={130}/><path fill="#343746" d="M64 107V92h14v15h6v4H58v-4zM60 134h12v5H60zm17 0h12v5H77z"/></g><g className="surprise-spark" fill="#f3db8c"><path d="m35 125 6-9 4 9-4 8zm70 8 5-8 5 8-5 8z"/></g></g> }
function PopcornParty() { return <g><path fill="#f0d4ab" d="m30 95 12 53h67l12-53z"/><path stroke="#cb91a1" strokeWidth="10" d="m45 99 9 45m21-45v45m28-45-7 45"/>{[0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(${40 + i * 17} ${91 - i % 2 * 9})`}><path className="surprise-popcorn" style={{ animationDelay: `${i * -.27}s` }} fill="#fff0be" d="M-7 3V-5h4v-5h9v5h5v8H6v4h-9V3z"/></g>)}</g> }
function PaperPlane() { return <g><PartyMouse x={23} y={145}/><path stroke="#b4a0bf" strokeDasharray="4 6" fill="none" d="M27 104q75-106 111-16"/><g className="surprise-plane"><path fill="#e6e3cf" d="m30 76 77-27-31 44-13-17-16 9z"/><path fill="#abc3c7" d="m63 76 44-27-31 44z"/></g></g> }
function GlowStickRave() { return <g><g className="surprise-rave"><PartyMouse x={55} y={139}/><g strokeWidth="5" strokeLinecap="square"><path stroke="#b8f0bf" d="m51 120-16-25m-1-1-5-12"/><path stroke="#f3a9df" d="m85 119 17-28m1-2 7-12"/></g></g><g className="surprise-spark" fill="#ddd2fb"><path d="M22 56h5v5h-5zm87 4h5v5h-5zM70 42h5v5h-5z"/></g></g> }

// Add one entry with a unique id, accessible description and SVG scene.
// Each scene uses a 150 × 160 local stage; selection stays fixed for a run.
export const DISCO_SURPRISES = [
  { id: 'cheese-delivery', description: 'A late guest rolls in an enormous cheese wheel', Scene: CheeseDelivery },
  { id: 'conga-line', description: 'Four mice form a conga line', Scene: CongaLine },
  { id: 'breakdancer', description: 'A mouse spins on the dance floor', Scene: Breakdancer },
  { id: 'sleeping-guest', description: 'One guest sleeps through the whole party', Scene: SleepingGuest },
  { id: 'spoon-slide', description: 'A mouse rides a scavenged spoon slide', Scene: SpoonSlide },
  { id: 'cat-window', description: 'A curious cat peeks in before the curtain closes', Scene: CatWindow },
  { id: 'balloon-lift', description: 'A mouse floats above the party holding balloons', Scene: BalloonLift },
  { id: 'tiny-band', description: 'A tiny mouse band plays along', Scene: TinyBand },
  { id: 'confetti-cannon', description: 'A party cannon showers the room with confetti', Scene: ConfettiCannon },
  { id: 'cheese-toast', description: 'Two mice raise a cheese toast', Scene: CheeseToast },
  { id: 'limbo-contest', description: 'A mouse shimmies beneath a tiny limbo bar', Scene: LimboContest },
  { id: 'cheese-juggler', description: 'A mouse juggles three wedges of cheese', Scene: CheeseJuggler },
  { id: 'roller-skater', description: 'A mouse glides past on pink roller skates', Scene: RollerSkater },
  { id: 'bubble-machine', description: 'A bottle-cap machine fills the club with bubbles', Scene: BubbleMachine },
  { id: 'photo-booth', description: 'Two dressed-up mice pose in a flashing photo booth', Scene: PhotoBooth },
  { id: 'sock-hammock', description: 'A relaxed guest swings in a tiny sock hammock', Scene: SockHammock },
  { id: 'tap-dancer', description: 'A top-hatted mouse performs a sparkling tap dance', Scene: TapDancer },
  { id: 'popcorn-party', description: 'Fresh popcorn bounces out of a striped party bucket', Scene: PopcornParty },
  { id: 'paper-plane', description: 'A guest launches a paper plane over the dance floor', Scene: PaperPlane },
  { id: 'glow-stick-rave', description: 'A mouse waves glowing sticks to the beat', Scene: GlowStickRave },
] satisfies { id: string; description: string; Scene: ComponentType }[]

/** Choose two distinct scenes without replacement, stable for the entire run. */
export function chooseDiscoSurprises(seed: number) {
  let state = seed >>> 0
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
  const available = [...DISCO_SURPRISES]
  return Array.from({ length: Math.min(2, available.length) }, () =>
    available.splice(Math.floor(random() * available.length), 1)[0])
}
