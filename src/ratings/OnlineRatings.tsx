import type { RatingsSnapshot } from './onlineTypes'
export default function OnlineRatings({ snapshot, error, saveStatus, delta, onRetry }: {
  snapshot: RatingsSnapshot | null; error: string; saveStatus: string; delta: number | null; onRetry: () => void
}) {
  return <div className="game-rating-status">
    <a href="/profile" title="Your rating and profile">Rating <strong>{snapshot ? `${Math.round(snapshot.player.rating)}${snapshot.player.rd > 110 ? '?' : ''}` : '…'}</strong></a>
    <span role="status">{saveStatus}{delta !== null && <strong className={delta >= 0 ? 'rating-gain' : 'rating-loss'}> · {delta >= 0 ? '+' : '−'}{Math.abs(Math.round(delta))}</strong>}</span>
    {error && <span className="rating-save-error" role="alert">{error} <button type="button" onClick={onRetry}>Retry</button></span>}
  </div>
}
