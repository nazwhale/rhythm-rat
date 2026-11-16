import assert from 'node:assert/strict'
import { updateRating, rateMatch, expectedScore } from '../src/ratings/glicko.ts'

// Published example in Glickman's Glicko-2 specification.
const example = updateRating({ rating: 1500, rd: 200, volatility: .06 }, [
  { rating: 1400, rd: 30, volatility: .06, score: 1 },
  { rating: 1550, rd: 100, volatility: .06, score: 0 },
  { rating: 1700, rd: 300, volatility: .06, score: 0 },
])
assert.ok(Math.abs(example.rating - 1464.06) < .02)
assert.ok(Math.abs(example.rd - 151.52) < .02)
assert.ok(Math.abs(example.volatility - .059996) < .000002)
const equal = { rating: 1500, rd: 200, volatility: .06 }
const match = rateMatch(equal, equal, true)
assert.ok(match.player.rating > 1500 && match.level.rating < 1500)
assert.ok(Math.abs(match.player.rating + match.level.rating - 3000) < 1e-8)
assert.equal(expectedScore(equal, equal), .5)
assert.ok(rateMatch(equal, { ...equal, rating: 1800 }, true).player.rating > rateMatch(equal, { ...equal, rating: 1200 }, true).player.rating)
for (const won of [true, false]) {
  let user = { ...equal, rd: 350 }, level = { ...equal }
  for (let i = 0; i < 500; i++) {
    const next = rateMatch(user, level, won); user = next.player; level = next.level
    assert.ok([user.rating, user.rd, user.volatility, level.rating, level.rd, level.volatility].every(Number.isFinite))
    assert.ok(user.rd > 0 && user.rd <= 350 && level.rd > 0 && level.rd <= 350)
  }
}
console.log('Verified the published Glicko-2 example, symmetric snapshots and 1000 repeated outcomes.')
