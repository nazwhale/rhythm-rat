import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../ratings/api'
import type { Leaderboard } from '../ratings/onlineTypes'
import PixelTrophy from './PixelTrophy'
export default function LeaderboardPage() {
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError('')
    try { const value = await api<Leaderboard>(`leaderboard?offset=${offset}`); if (current === generation.current) setBoard(value) }
    catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : 'Could not load the leaderboard.') }
    finally { if (current === generation.current) setLoading(false) }
  }, [offset])
  useEffect(() => { void load(); return () => { generation.current++ } }, [load])
  return <>
    <section className="account-hero leaderboard-hero"><PixelTrophy className="hero-trophy" /><div><p className="account-eyebrow">THE CHEESE CHAMPIONS</p><h1>Leaderboard</h1><p>Little paws. Big ratings.</p></div></section>
    <section className="profile-card leaderboard-card">
      {loading && <p role="status">Loading the leaderboard…</p>}
      {error && <p role="alert">{error} <button onClick={() => void load()}>Retry</button></p>}
      {board && !board.entries.length && <div className="leaderboard-empty"><PixelTrophy /><h2>The podium is waiting.</h2><p>Complete a <a href="/">rated challenge</a> to appear here.</p></div>}
      {board && !!board.entries.length && <><div className="leaderboard-table-wrap"><table className="leaderboard-table"><caption className="sr-only">Players ranked by Glicko-2 rating</caption><thead><tr><th scope="col">Rank</th><th scope="col">Username</th><th scope="col">Rating</th><th scope="col">Rated runs</th></tr></thead><tbody>{board.entries.map(entry => <tr key={entry.id} className={entry.rank <= 3 ? 'podium-row' : undefined}><td><span className="rank-cell">{entry.rank <= 3 && <PixelTrophy place={entry.rank} />}<span>{entry.rank}</span></span></td><th scope="row">{entry.username}</th><td className="leaderboard-rating">{Math.round(entry.rating)}{entry.rd > 110 ? '?' : ''}</td><td>{entry.games}</td></tr>)}</tbody></table></div>
        <div className="leaderboard-pagination"><button className="account-button" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - board.limit))}>Previous</button><span>{offset + 1}–{Math.min(offset + board.limit, board.total)} of {board.total}</span><button className="account-button" disabled={loading || offset + board.limit >= board.total} onClick={() => setOffset(offset + board.limit)}>Next</button></div></>}
      <p className="account-note">Players appear after their first rated run. ? marks a provisional rating. Ties use rated-run count, then username.</p>
      <p className="account-note"><a href="/profile">Choose your username in My profile.</a> Email addresses stay private.</p>
    </section>
  </>
}
