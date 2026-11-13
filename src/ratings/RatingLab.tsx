import { memo } from 'react'
import type { Level } from '../level'
import { expectedScore } from './glicko'
import { levelRating, playerRating, type LabDB } from './store'

export default memo(function RatingLab({ db, error, ready, canReset, levels, rated, busy, onChallenge, onPractice, onRename, onExport, onReset }: {
  db: LabDB; error: string; ready: boolean; canReset: boolean; levels: Level[]; rated: boolean; busy: boolean
  onChallenge: () => void; onPractice: () => void; onRename: (name: string) => void; onExport: () => void; onReset: () => void
}) {
  const player = playerRating(db)
  const recent = db.ratingEvents.slice(-8).reverse()
  return <details className="rating-lab">
    <summary>Rating experiment <span>{Math.round(player.rating)}{player.rd > 110 ? '?' : ''} · {player.games} rated runs · {rated ? 'Rated challenge' : 'Practice'}</span></summary>
    <div className="rating-lab-body">
      <p>Saved in this browser only. Each browser has its own player and level ratings. Export results to compare what you learn.</p>
      <div className="rating-lab-stats">
        <div><strong>{Math.round(player.rating)}{player.rd > 110 ? '?' : ''}</strong><span>Your rating</span></div>
        <div><strong>{Math.round(player.rd)}</strong><span>Uncertainty (lower is better)</span></div>
        <div><strong>{player.games}</strong><span>Rated first attempts</span></div>
      </div>
      <label className="rating-lab-name">Player name <input maxLength={60} value={db.user.name} disabled={busy || !!error || !ready} onChange={(event) => onRename(event.target.value)} /></label>
      <p>First attempts affect your rating and the level’s difficulty. Second bite is practice. Repeats are allowed for this experiment; starting a new level or refreshing after gameplay begins counts as a loss. Campaign order and scenery stay fixed.</p>
      <div className="rating-lab-actions">
        <button disabled={busy || !!error || !ready} onClick={(event) => { event.currentTarget.blur(); onChallenge(); event.currentTarget.closest('details')?.removeAttribute('open') }}>Find my next challenge</button>
        <button disabled={busy} onClick={(event) => { event.currentTarget.blur(); onPractice(); event.currentTarget.closest('details')?.removeAttribute('open') }}>Normal practice</button>
        <button onClick={onExport}>Export results</button>
        <button disabled={busy || !canReset} onClick={onReset}>Reset experiment</button>
      </div>
      {error && <p className="rating-lab-error" role="alert">{error} Normal practice is still available.</p>}
      <div className="rating-lab-result" aria-live="polite">{recent[0] ? (() => {
        const change = db.ratingChanges.find((entry) => entry.eventId === recent[0].id && entry.ratingId === player.id)!
        const delta = Math.round(change.after.rating - change.before.rating)
        return `Last rated run: ${recent[0].won ? 'won' : 'lost'} · ${delta >= 0 ? '+' : ''}${delta} rating. Second bite never changes this result.`
      })() : 'Choose “Find my next challenge”, then start the run to try it.'}</div>
      {recent.length > 0 && <div className="rating-lab-table"><table><caption>Recent rated runs</caption><thead><tr><th>Level</th><th>Result</th><th>Your rating</th></tr></thead><tbody>{recent.map((event) => {
        const encounter = db.encounters.find((entry) => entry.id === event.encounterId)!
        const version = db.levelVersions.find((entry) => entry.id === encounter.levelVersionId)!
        const change = db.ratingChanges.find((entry) => entry.eventId === event.id && entry.ratingId === player.id)!
        return <tr key={event.id}><td>{version.title}</td><td>{event.won ? 'Win' : 'Loss'}</td><td>{Math.round(change.before.rating)} → {Math.round(change.after.rating)}</td></tr>
      })}</tbody></table></div>}
      <details><summary>Level difficulties in this browser</summary><div className="rating-lab-table"><table><thead><tr><th>Level</th><th>Difficulty</th><th>RD</th><th>Runs</th><th>Est. pass chance</th></tr></thead><tbody>{levels.map((level) => {
        const rating = levelRating(db, level)
        return <tr key={level.id}><td>{level.title}</td><td>{Math.round(rating.rating)}{rating.rd > 110 ? '?' : ''}</td><td>{Math.round(rating.rd)}</td><td>{rating.games}</td><td>{Math.round(expectedScore(player, rating) * 100)}%</td></tr>
      })}</tbody></table></div></details>
      <p className="rating-lab-footnote">? means provisional. Glicko-2 is updated once per first attempt, without inactivity decay. These are experimental estimates from one person, not shared or competitive ratings. Clearing browser data removes this history.</p>
    </div>
  </details>
})
