import { expectedScore, type Rating } from './glicko.ts'

type Candidate = { id: string; rating: Rating }
type RecommendationOptions = {
  easierThan?: Rating
  random?: () => number
}

const PRACTICE_BAND = { min: 0.65, target: 0.70, max: 0.75 }
const STRETCH_BAND = { min: 0.45, target: 0.47, max: 0.49 }
const STRETCH_CHANCE = 0.30

function preferFreshPuzzles(pool: Candidate[], recent: string[]) {
  const recentlyPlayed = recent.slice(0, 3)
  const fresh = pool.filter(candidate => !recentlyPlayed.includes(candidate.id))
  return fresh.length ? fresh : pool
}

function chooseDifficultyPool(player: Rating, candidates: Candidate[], random: () => number, easierThan?: Rating) {
  if (easierThan) {
    const recovery = candidates.filter(candidate => candidate.rating.rating < easierThan.rating)
    return { pool: recovery.length ? recovery : candidates, band: PRACTICE_BAND }
  }

  const harder = candidates.filter(candidate => candidate.rating.rating > player.rating)
  if (random() < STRETCH_CHANCE && harder.length) return { pool: harder, band: STRETCH_BAND }

  const practice = candidates.filter(candidate => candidate.rating.rating <= player.rating)
  return { pool: practice.length ? practice : candidates, band: PRACTICE_BAND }
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
  easierThan, random = Math.random,
}: RecommendationOptions = {}) {
  if (!candidates.length) return 0
  const { pool, band } = chooseDifficultyPool(player, candidates, random, easierThan)
  return candidates.indexOf(pickPuzzle(player, preferFreshPuzzles(pool, recent), band, random))
}
