import { Cheese } from '../Cheese'
import PixelTrophy from './PixelTrophy'
export default function SiteNav({ path }: { path: string }) {
  return <nav className="account-navigation" aria-label="Main navigation">
    <a href="/" aria-current={path === '/' ? 'page' : undefined}><span className="nav-icon" aria-hidden="true"><Cheese duration="q" /></span>Play</a>
    <a href="/profile" aria-current={path === '/profile' ? 'page' : undefined}><img className="nav-icon" src="/rhythm-rat.svg" alt="" />My profile</a>
    <a href="/puzzles" aria-current={path === '/puzzles' ? 'page' : undefined}><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 20 20" shapeRendering="crispEdges"><path fill="#e2b854" d="M1 1h7v7H1zm11 0h7v7h-7zM1 12h7v7H1zm11 0h7v7h-7z" /><path fill="#f7dfa0" d="M2 2h5v2H2zm11 0h5v2h-5zM2 13h5v2H2zm11 0h5v2h-5z" /></svg></span>Puzzles</a>
    <a href="/leaderboard" aria-current={path === '/leaderboard' ? 'page' : undefined}><span aria-hidden="true"><PixelTrophy /></span>Leaderboard</a>
  </nav>
}
