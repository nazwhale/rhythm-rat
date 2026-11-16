import type { RatingsSnapshot } from '../shared/apiContract'
export default function OnlineRatings({ snapshot, levelId, error, saveStatus, delta, onRetry }: {
  snapshot: RatingsSnapshot | null; levelId?: string; error: string; saveStatus: string; delta: number | null; onRetry: () => void
}) {
  const puzzle = snapshot?.puzzles.find(entry => entry.levelId === levelId)
  return <div className="game-rating-status">
    <a href="/profile" title="Your rating and profile">Your rating <strong>{snapshot ? `${Math.round(snapshot.player.rating)}${snapshot.player.rd > 110 ? '?' : ''}` : '…'}</strong></a>
    {levelId && <span>Puzzle rating <strong>{puzzle ? `${Math.round(puzzle.rating)}${puzzle.rd > 110 ? '?' : ''}` : '…'}</strong></span>}
    <span role="status">{saveStatus}{delta !== null && <strong className={delta >= 0 ? 'rating-gain' : 'rating-loss'}> · {delta >= 0 ? '+' : '−'}{Math.abs(Math.round(delta))}</strong>}</span>
    {error && <span className="rating-save-error" role="alert">{error} <button type="button" onClick={onRetry}>Retry</button></span>}
  </div>
}
