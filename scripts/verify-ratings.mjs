import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { updateRating, rateMatch, expectedScore } from '../src/ratings/glicko.ts'
import { newDB, syncLevels, beginAttempt, endAttempt, recoverOpenAttempts, playerRating, levelRating, versionFor, recommendLevel, loadDB, saveDB, STORAGE_KEY } from '../src/ratings/store.ts'

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
const dir = new URL('../src/levels/', import.meta.url)
const levels = await Promise.all((await readdir(dir)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(new URL(name, dir), 'utf8'))))
const level = levels.find(l => l.id === 'the-first-lap')
const initial = syncLevels(newDB(), levels)
assert.equal(playerRating(initial).rating, 1500)
assert.equal(levelRating(initial, level).rating, level.rating + 500)
assert.equal(syncLevels(initial, levels).ratings.length, initial.ratings.length)
assert.equal(versionFor({ ...level, title: 'New title', rating: 1 }).id, versionFor(level).id)
assert.notEqual(versionFor({ ...level, bpm: 100 }).id, versionFor(level).id)
const now = 1000000
const first = beginAttempt(initial, level, 1, now, 2000)
assert.throws(() => beginAttempt(first.db, level, 1, now, 2000), /in progress/)
const lost = endAttempt(first.db, first.attemptId, 'loss', now + 3000, { perfect: 0, good: 0, miss: 1, extra: 0, longest: 0 })
assert.equal(initial.attempts.length, 0, 'State changes must be immutable')
assert.equal(lost.ratingEvents.length, 1)
assert.equal(lost.ratingChanges.length, 2)
assert.ok(playerRating(lost).rating < 1500 && levelRating(lost, level).rating > 1500)
assert.equal(endAttempt(lost, first.attemptId, 'win', now + 4000, null), lost, 'Duplicate finishes must never change a result')
const retry = beginAttempt(lost, level, 2, now + 5000, 2000, first.encounterId)
const retryWin = endAttempt(retry.db, retry.attemptId, 'win', now + 9000, null)
assert.equal(retryWin.ratingEvents.length, 1)
assert.deepEqual(playerRating(retryWin), playerRating(lost))
assert.equal(retryWin.attempts.length, 2)
assert.equal(retryWin.encounters.length, 1)
assert.equal(recoverOpenAttempts(first.db, now + 1000).ratingEvents.length, 0, 'Leaving count-in is void')
const refreshed = recoverOpenAttempts(first.db, now + 3000)
assert.equal(refreshed.ratingEvents.length, 1, 'Leaving gameplay is a loss')
assert.deepEqual(recoverOpenAttempts(refreshed, now + 4000), refreshed, 'Recovery is idempotent')
assert.equal(recoverOpenAttempts(retry.db, now + 9000).ratingEvents.length, 1, 'Leaving a retry never rates twice')
assert.throws(() => beginAttempt(retry.db, level, 2, now, 2000, first.encounterId))
const recommended = levels[recommendLevel(initial, levels)]
assert.ok(expectedScore(playerRating(initial), levelRating(initial, recommended)) > .5)
const easier = levels[recommendLevel(initial, levels, level)]
assert.ok(levelRating(initial, easier).rating < levelRating(initial, level).rating)
const storage = { data: null, getItem() { return this.data }, setItem(_key, value) { this.data = value } }
const saved = saveDB(storage, initial)
assert.equal(loadDB(storage, levels).user.id, initial.user.id)
assert.equal(loadDB(storage, levels).revision, saved.revision)
assert.throws(() => saveDB(storage, initial), /another tab/)
assert.equal(saveDB(storage, saved).revision, 2)
assert.throws(() => saveDB({ getItem: () => null, setItem: () => { throw new Error('quota') } }, initial), /quota/)
storage.data = JSON.stringify({ ...initial, schemaVersion: 99 })
assert.throws(() => loadDB(storage, levels), /incompatible/)
storage.data = '{broken'
assert.throws(() => loadDB(storage, levels))
storage.data = JSON.stringify(lost)
assert.deepEqual(loadDB(storage, levels).ratingChanges, lost.ratingChanges)
storage.data = JSON.stringify({ ...lost, ratingChanges: [] })
assert.throws(() => loadDB(storage, levels), /inconsistent/)
assert.ok(STORAGE_KEY.includes('v1'))
console.log('Verified Glicko-2 reference example, symmetric snapshots, 1000 repeated outcomes, versioning, unrated retries, abandonment/recovery, idempotency, recommendations and storage failures.')
