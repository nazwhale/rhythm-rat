import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../ratings/api'
import type { Profile } from '../ratings/onlineTypes'
import LoginDialog from '../ratings/LoginDialog'
import RatingGraph from './RatingGraph'
import PuzzlePreview from './PuzzlePreview'
import { usePuzzlePreview } from './usePuzzlePreview'

export default function ProfilePage() {
  const { preview, previewId, close, triggerProps } = usePuzzlePreview()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [signedOut, setSignedOut] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [error, setError] = useState('')
  const [visibleResults, setVisibleResults] = useState(20)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const generation = useRef(0)
  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError('')
    try {
      const value = await api<Profile>('profile')
      if (current !== generation.current) return
      setProfile(value); setUsername(value.username); setSignedOut(false)
    } catch (err) {
      if (current !== generation.current) return
      if (err instanceof ApiError && err.status === 401) { setSignedOut(true); setProfile(null) }
      else setError(err instanceof Error ? err.message : 'Could not load your profile.')
    } finally { if (current === generation.current) setLoading(false) }
  }, [])
  useEffect(() => {
    const saved = () => { void load() }
    void load(); window.addEventListener('rhythm-rat:ratings-saved', saved)
    return () => { generation.current++; window.removeEventListener('rhythm-rat:ratings-saved', saved) }
  }, [load])
  return <>
    <section className="account-hero"><p className="account-eyebrow">YOUR LITTLE RAT CORNER</p><h1>My profile</h1><p>A name for the leaderboard. A trail of every rated nibble.</p></section>
    {loading && <p role="status">Loading your profile…</p>}
    {signedOut && <section className="profile-card"><h2>Your rating follows you.</h2><p>Sign in to choose a username and see your progress over time.</p><button className="account-button" onClick={() => setLoginOpen(true)}>Sign in with email</button></section>}
    {loginOpen && <LoginDialog onCancel={() => setLoginOpen(false)} onLogin={async () => { setLoginOpen(false); await load() }} />}
    {error && <p role="alert">{error} <button onClick={() => void load()}>Retry</button></p>}
    {profile && <>
      <section className="profile-card profile-identity"><div><p className="account-eyebrow">SQUEAK, IT’S YOU</p><h2>{profile.username}</h2><p>Joined {new Date(profile.createdAt).toLocaleDateString()}</p></div>
        <form onSubmit={async event => {
          event.preventDefault(); setSaving(true); setError(''); setMessage('')
          try { const result = await api<{ username: string }>('profile', { username }); setProfile(p => p ? { ...p, username: result.username } : p); setUsername(result.username); setMessage('Username saved.') }
          catch (err) { setError(err instanceof Error ? err.message : 'Could not save your username.') }
          finally { setSaving(false) }
        }}><label htmlFor="profile-username">Username</label><div className="username-controls"><input id="profile-username" name="username" autoComplete="nickname" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_\-]{3,32}" value={username} disabled={saving} onChange={event => { setUsername(event.target.value); setMessage('') }} /><button className="account-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save'}</button></div><small>3–32 letters, numbers, hyphens or underscores. Visible on the leaderboard.</small><p role="status">{message}</p></form>
      </section>
      <dl className="profile-stats"><div><dt>Rating</dt><dd>{Math.round(profile.rating)}{profile.rd > 110 ? '?' : ''}</dd></div><div><dt>Rated runs</dt><dd>{profile.games}</dd></div><div><dt>Wins</dt><dd>{profile.wins}</dd></div><div><dt>Draws</dt><dd>{profile.draws}</dd></div><div><dt>Win rate</dt><dd>{profile.games ? `${Math.round(profile.wins / profile.games * 100)}%` : '—'}</dd></div></dl>
      <section className="profile-card"><div className="section-heading"><h2>Rating over time</h2><span>Glicko-2 · current rules</span></div><RatingGraph points={profile.history} />
        {profile.olderResultsMissing > 0 && <p className="account-note">Earlier games were played before rating history was recorded. This graph shows the known rating points; those earlier intermediate ratings are unavailable.</p>}
        {!profile.games && <p>Start with {profile.initialRating}. Play a <a href="/">rated challenge</a> to add your first result.</p>}
        <p className="account-note">All points are recalculated under the current rating rules. Each point shows a rated challenge: first-bite wins, second-bite draws, or losses. ? means provisional. Unrated runs do not change this graph.</p>
      </section>
      <section className="profile-card"><div className="section-heading"><h2>Rated challenges</h2><span>{profile.games} played</span></div>
        {!profile.results.length ? <p>Your completed rated challenges will appear here.</p> : <><div className="leaderboard-table-wrap"><table className="leaderboard-table results-table"><caption className="sr-only">Your puzzle results, newest first</caption><thead><tr><th scope="col">Puzzle</th><th scope="col">Result</th><th scope="col">Rating</th><th scope="col">Played</th></tr></thead><tbody>{profile.results.slice(0,visibleResults).map(result => {
          const trigger = triggerProps(result.id, result.previewLevelId)
          return <tr key={result.id}><th scope="row">{trigger ? <button {...trigger}>{result.title}<span aria-hidden="true"> ♩</span></button> : result.title}</th><td><span className={`outcome-badge outcome-${result.won ? 'win' : result.draw ? 'draw' : 'loss'}`}>{result.won ? 'Win' : result.draw ? 'Draw' : 'Loss'}</span></td><td>{Math.round(result.rating)}</td><td><time dateTime={new Date(result.acceptedAt).toISOString()}>{new Date(result.acceptedAt).toLocaleString()}</time></td></tr>
        })}</tbody></table></div>
        {visibleResults < profile.results.length && <button className="account-button" onClick={() => setVisibleResults(count=>count+20)}>Show more results</button>}</>}
      </section>
      <p><button className="text-button" onClick={async () => { try { await api('auth/logout', {}); generation.current++; close(); setProfile(null); setSignedOut(true) } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out.') } }}>Sign out</button></p>
    </>}
    {profile && preview && <PuzzlePreview id={previewId} preview={preview} onClose={close} />}
  </>
}
