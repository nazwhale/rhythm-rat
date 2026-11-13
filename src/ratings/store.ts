import { rateMatch, expectedScore, type Rating } from './glicko.ts'
import type { Level } from '../level.ts'

export const STORAGE_KEY = 'rhythm-rat:rating-lab:v1'
export const POOL = 'rhythm-110-v1'
export type LevelVersion = { id: string; levelId: string; title: string; seedRating: number; content: Pick<Level, 'bpm' | 'beatsPerBar' | 'bars'> }
export type RatingRow = Rating & { id: string; subjectType: 'user' | 'level'; subjectId: string; poolId: string; games: number }
export type Encounter = { id: string; userId: string; levelVersionId: string; poolId: string; createdAt: number }
export type Attempt = { id: string; encounterId: string; number: number; startedAt: number; gameplayAt: number; endedAt: number | null; outcome: 'open' | 'win' | 'loss' | 'void'; reason: string; counts: Counts | null }
export type Counts = { perfect: number; good: number; miss: number; extra: number; longest: number }
export type RatingEvent = { id: string; encounterId: string; attemptId: string; won: boolean; createdAt: number; algorithm: string }
export type Change = { eventId: string; ratingId: string; before: Rating; after: Rating }
export type LabDB = {
  schemaVersion: 1; revision: number; user: { id: string; name: string }
  pool: { id: string; algorithm: string; tau: number; policy: string }
  levelVersions: LevelVersion[]; ratings: RatingRow[]; encounters: Encounter[]; attempts: Attempt[]; ratingEvents: RatingEvent[]; ratingChanges: Change[]
}
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
const id = () => crypto.randomUUID()

export function versionFor(level: Level): LevelVersion {
  const content = { bpm: level.bpm, beatsPerBar: level.beatsPerBar, bars: level.bars }
  // Content-derived local version, not a security checksum; retain full content for migration.
  let hash = 2166136261
  for (const char of JSON.stringify(content)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return { id: `${level.id}:${hash.toString(16)}`, levelId: level.id, title: level.title, seedRating: level.rating + 500, content }
}
export function newDB(): LabDB {
  const userId = id()
  return { schemaVersion: 1, revision: 0, user: { id: userId, name: 'Local player' }, pool: { id: POOL, algorithm: 'glicko2-online-v1', tau: .5, policy: 'first-attempt-only; repeats-allowed; no-calendar-decay' }, levelVersions: [], ratings: [{ id: id(), subjectId: userId, subjectType: 'user', poolId: POOL, rating: 1500, rd: 350, volatility: .06, games: 0 }], encounters: [], attempts: [], ratingEvents: [], ratingChanges: [] }
}
export function syncLevels(db: LabDB, levels: Level[]): LabDB {
  const next = structuredClone(db)
  for (const level of levels) {
    const version = versionFor(level)
    if (next.levelVersions.some((entry) => entry.id === version.id)) continue
    next.levelVersions.push(version)
    next.ratings.push({ id: id(), subjectId: version.id, subjectType: 'level', poolId: POOL, rating: version.seedRating, rd: 200, volatility: .06, games: 0 })
  }
  return next
}
export function playerRating(db: LabDB) { return db.ratings.find((row) => row.subjectType === 'user')! }
export function levelRating(db: LabDB, level: Level) { return db.ratings.find((row) => row.subjectType === 'level' && row.subjectId === versionFor(level).id)! }

export function beginAttempt(db: LabDB, level: Level, number: number, now: number, countInMs: number, encounterId?: string): { db: LabDB; attemptId: string; encounterId: string } {
  if (db.attempts.some((attempt) => attempt.outcome === 'open')) throw new Error('A run is already in progress. Finish it before starting another.')
  const next = structuredClone(db)
  let encounter = number === 2 ? next.encounters.find((entry) => entry.id === encounterId && entry.levelVersionId === versionFor(level).id) : undefined
  if (!encounter) {
    encounter = { id: id(), userId: next.user.id, levelVersionId: versionFor(level).id, poolId: POOL, createdAt: now }
    next.encounters.push(encounter)
  }
  if (next.attempts.some((attempt) => attempt.encounterId === encounter.id && attempt.number === number)) throw new Error('This attempt has already started. Reload before continuing.')
  const attemptId = id()
  next.attempts.push({ id: attemptId, encounterId: encounter.id, number, startedAt: now, gameplayAt: now + countInMs, endedAt: null, outcome: 'open', reason: '', counts: null })
  return { db: next, attemptId, encounterId: encounter.id }
}
export function endAttempt(db: LabDB, attemptId: string, outcome: 'win' | 'loss' | 'void', now: number, counts: Counts | null, reason = ''): LabDB {
  const next = structuredClone(db)
  const attempt = next.attempts.find((entry) => entry.id === attemptId)
  if (!attempt || attempt.outcome !== 'open') return db
  Object.assign(attempt, { outcome, endedAt: now, counts, reason })
  if (attempt.number !== 1 || outcome === 'void' || next.ratingEvents.some((entry) => entry.encounterId === attempt.encounterId)) return next
  const encounter = next.encounters.find((entry) => entry.id === attempt.encounterId)!
  const player = playerRating(next)
  const level = next.ratings.find((row) => row.subjectType === 'level' && row.subjectId === encounter.levelVersionId)!
  const updated = rateMatch(player, level, outcome === 'win')
  const event = { id: id(), encounterId: encounter.id, attemptId, won: outcome === 'win', createdAt: now, algorithm: next.pool.algorithm }
  next.ratingEvents.push(event)
  for (const [row, after] of [[player, updated.player], [level, updated.level]] as const) {
    const before = { rating: row.rating, rd: row.rd, volatility: row.volatility }
    next.ratingChanges.push({ eventId: event.id, ratingId: row.id, before, after })
    Object.assign(row, after, { games: row.games + 1 })
  }
  return next
}
export function recoverOpenAttempts(db: LabDB, now: number): LabDB {
  let next = db
  for (const attempt of db.attempts.filter((entry) => entry.outcome === 'open')) {
    next = endAttempt(next, attempt.id, now < attempt.gameplayAt ? 'void' : 'loss', now, null, 'Left or refreshed the run')
  }
  return next
}
export function recommendLevel(db: LabDB, levels: Level[], easierThan?: Level) {
  const recent = new Set(db.encounters.slice(-3).map((entry) => entry.levelVersionId))
  const ceiling = easierThan ? levelRating(db, easierThan).rating : Infinity
  const candidates = levels.map((level, index) => ({ level, index, rating: levelRating(db, level) })).filter(({ rating }) => rating.rating < ceiling)
  const pool = candidates.length ? candidates : [{ level: easierThan ?? levels[0], index: Math.max(0, levels.findIndex((level) => level.id === easierThan?.id)), rating: levelRating(db, easierThan ?? levels[0]) }]
  const fresh = pool.filter(({ level }) => !recent.has(versionFor(level).id))
  return (fresh.length ? fresh : pool).sort((a, b) => Math.abs(expectedScore(playerRating(db), a.rating) - .7) - Math.abs(expectedScore(playerRating(db), b.rating) - .7))[0].index
}

export function loadDB(storage: StoragePort, levels: Level[]) {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return syncLevels(newDB(), levels)
  const db = JSON.parse(raw) as LabDB
  // Fail closed instead of silently discarding incompatible or corrupt data.
  if (db.schemaVersion !== 1 || db.pool?.id !== POOL || !Number.isInteger(db.revision) || !db.user?.id || typeof db.user.name !== 'string') throw new Error('Saved rating data is incompatible. Export it or reset this experiment.')
  for (const key of ['levelVersions', 'ratings', 'encounters', 'attempts', 'ratingEvents', 'ratingChanges'] as const) if (!Array.isArray(db[key])) throw new Error('Saved rating data is incomplete. Reset the experiment to continue.')
  if (db.ratings.filter((row) => row.subjectType === 'user' && row.subjectId === db.user.id).length !== 1 || db.ratings.some((row) => !Number.isFinite(row.rating) || !Number.isFinite(row.rd) || row.rd <= 0 || !Number.isFinite(row.volatility) || row.volatility <= 0)) throw new Error('Saved ratings are invalid. Reset the experiment to continue.')
  const unique = (values: string[]) => new Set(values).size === values.length
  const validRating = (row: Rating) => row && Number.isFinite(row.rating) && Number.isFinite(row.rd) && row.rd > 0 && Number.isFinite(row.volatility) && row.volatility > 0
  const valid = unique(db.ratings.map(row => row.id)) && unique(db.levelVersions.map(row => row.id)) && unique(db.encounters.map(row => row.id)) && unique(db.attempts.map(row => row.id)) && unique(db.ratingEvents.map(row => row.id)) && unique(db.ratingEvents.map(row => row.encounterId))
    && db.levelVersions.every(row => typeof row.id === 'string' && typeof row.title === 'string' && row.content && Array.isArray(row.content.bars))
    && db.ratings.every(row => row.poolId === POOL && Number.isInteger(row.games) && row.games >= 0 && (row.subjectType === 'user' ? row.subjectId === db.user.id : row.subjectType === 'level' && db.levelVersions.some(version => version.id === row.subjectId)))
    && unique(db.ratings.map(row => `${row.subjectType}:${row.subjectId}`))
    && db.levelVersions.every(version => db.ratings.some(row => row.subjectType === 'level' && row.subjectId === version.id))
    && db.encounters.every(row => row.userId === db.user.id && row.poolId === POOL && db.levelVersions.some(version => version.id === row.levelVersionId))
    && db.attempts.every(row => db.encounters.some(encounter => encounter.id === row.encounterId) && [1, 2].includes(row.number) && ['open', 'win', 'loss', 'void'].includes(row.outcome) && Number.isFinite(row.startedAt) && Number.isFinite(row.gameplayAt))
    && unique(db.attempts.map(row => `${row.encounterId}:${row.number}`))
    && db.ratingEvents.every(row => typeof row.won === 'boolean' && db.attempts.some(attempt => attempt.id === row.attemptId && attempt.encounterId === row.encounterId && attempt.number === 1 && attempt.outcome === (row.won ? 'win' : 'loss')) && db.ratingChanges.filter(change => change.eventId === row.id).length === 2)
    && db.ratingChanges.every(row => db.ratingEvents.some(event => event.id === row.eventId) && db.ratings.some(rating => rating.id === row.ratingId) && validRating(row.before) && validRating(row.after))
    && unique(db.ratingChanges.map(row => `${row.eventId}:${row.ratingId}`))
  if (!valid) throw new Error('Saved rating history is inconsistent. Export it or reset the experiment.')
  return syncLevels(db, levels)
}
export function saveDB(storage: StoragePort, db: LabDB): LabDB {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw && JSON.parse(raw).revision !== db.revision) throw new Error('Rating data changed in another tab. Reload this page before continuing.')
  const next = { ...db, revision: db.revision + 1 }
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
