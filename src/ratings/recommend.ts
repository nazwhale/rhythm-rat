import { expectedScore, type Rating } from './glicko.ts'
export function recommendIndex(player: Rating, candidates: { id: string; rating: Rating }[], recent: string[], easierThan?: Rating) {
  if (!candidates.length) return 0
  const easier = candidates.filter(c => !easierThan || c.rating.rating < easierThan.rating)
  const pool = easier.length ? easier : candidates
  const fresh = pool.filter(c => !recent.slice(0, 3).includes(c.id))
  const selected = (fresh.length ? fresh : pool).reduce((best, c) =>
    Math.abs(expectedScore(player, c.rating) - .7) < Math.abs(expectedScore(player, best.rating) - .7) ? c : best)
  return candidates.indexOf(selected)
}
