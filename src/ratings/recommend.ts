import { expectedScore, type Rating } from './glicko.ts'

type Candidate = { id: string; rating: Rating }
type RecommendationOptions = {
  easierThan?: Rating
  afterFirstBiteWin?: boolean
  random?: () => number
}

const PRACTICE_BAND = { min: 0.65, target: 0.70, max: 0.75 }
const STRETCH_BAND = { min: 0.45, target: 0.50, max: 0.55 }
const STRETCH_CHANCE = 0.25

function eligiblePuzzlePool(candidates: Candidate[], recent: string[], easierThan?: Rating) {
  const easier = easierThan ? candidates.filter(candidate => candidate.rating.rating < easierThan.rating) : candidates
  const pool = easier.length ? easier : candidates
  const recentlyPlayed = recent.slice(0, 3)
  const fresh = pool.filter(candidate => !recentlyPlayed.includes(candidate.id))
  return fresh.length ? fresh : pool
}

function pickWeighted<T>(choices: { value: T; weight: number }[], random: () => number): T {
  let roll = random() * choices.reduce((total, choice) => total + choice.weight, 0)
  for (const choice of choices) {
    roll -= choice.weight
    if (roll < 0) return choice.value
  }
  return choices[choices.length - 1].value
}

function pickPuzzle(player: Rating, pool: Candidate[], band: typeof PRACTICE_BAND, random: () => number) {
  const scored = pool.map(candidate => {
    const score = expectedScore(player, candidate.rating)
    return { candidate, score, distance: Math.abs(score - band.target) }
  })
  const inBand = scored.filter(({ score }) => score >= band.min && score <= band.max)
  if (!inBand.length) {
    return scored.reduce((best, entry) => entry.distance < best.distance ? entry : best).candidate
  }

  const halfWidth = (band.max - band.min) / 2
  return pickWeighted(inBand.map(({ candidate, distance }) => ({
    value: candidate,
    weight: 1 - 0.5 * distance / halfWidth,
  })), random)
}

export function recommendIndex(player: Rating, candidates: Candidate[], recent: string[], {
  easierThan, afterFirstBiteWin, random = Math.random,
}: RecommendationOptions = {}) {
  if (!candidates.length) return 0
  const pool = eligiblePuzzlePool(candidates, recent, easierThan)
  const band = afterFirstBiteWin && !easierThan && random() < STRETCH_CHANCE ? STRETCH_BAND : PRACTICE_BAND
  return candidates.indexOf(pickPuzzle(player, pool, band, random))
}
