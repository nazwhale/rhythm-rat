export type Rating = { rating: number; rd: number; volatility: number }
export type Opponent = Rating & { score: number }
const SCALE = 173.7178
const TAU = 0.5
const g = (phi: number) => 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI))

export function expectedScore(player: Rating, opponent: Rating) {
  return 1 / (1 + Math.exp(-g(opponent.rd / SCALE) * (player.rating - opponent.rating) / SCALE))
}

// Glickman's Glicko-2 algorithm, including the revised volatility root solver.
// Online experiment: each rated encounter is one rating period. No calendar decay.
export function updateRating(player: Rating, opponents: Opponent[]): Rating {
  const mu = (player.rating - 1500) / SCALE
  const phi = player.rd / SCALE
  if (!opponents.length) return { ...player, rd: Math.min(350, SCALE * Math.sqrt(phi * phi + player.volatility ** 2)) }
  let information = 0, improvement = 0
  for (const opponent of opponents) {
    const weight = g(opponent.rd / SCALE)
    const expected = expectedScore(player, opponent)
    information += weight * weight * expected * (1 - expected)
    improvement += weight * (opponent.score - expected)
  }
  const variance = 1 / Math.max(information, 1e-15)
  const delta = variance * improvement
  const a = Math.log(player.volatility ** 2)
  const f = (x: number) => {
    const ex = Math.exp(x)
    return ex * (delta * delta - phi * phi - variance - ex) / (2 * (phi * phi + variance + ex) ** 2) - (x - a) / (TAU * TAU)
  }
  let A = a
  let B = delta * delta > phi * phi + variance ? Math.log(delta * delta - phi * phi - variance) : a - TAU
  for (let k = 2; f(B) < 0 && delta * delta <= phi * phi + variance && k < 1000; k++) B = a - k * TAU
  let fA = f(A), fB = f(B)
  for (let iteration = 0; Math.abs(B - A) > 0.000001 && iteration < 1000; iteration++) {
    const C = A + (A - B) * fA / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) { A = B; fA = fB } else fA /= 2
    B = C; fB = fC
  }
  const volatility = Math.exp(A / 2)
  const prePhi = Math.sqrt(phi * phi + volatility * volatility)
  const newPhi = 1 / Math.sqrt(1 / (prePhi * prePhi) + 1 / variance)
  return { rating: 1500 + SCALE * (mu + newPhi * newPhi * improvement), rd: Math.min(350, SCALE * newPhi), volatility }
}

export function rateMatch(player: Rating, level: Rating, won: boolean) {
  // Both updates use the original opponent, never the other's updated rating.
  return {
    player: updateRating(player, [{ ...level, score: won ? 1 : 0 }]),
    level: updateRating(level, [{ ...player, score: won ? 0 : 1 }]),
  }
}
