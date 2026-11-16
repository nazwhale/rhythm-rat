import type { GetResponses, Leaderboard, Profile, PuzzleRating, RecentResult } from '../src/shared/apiContract'
import type { Rating } from '../src/ratings/glicko'
import { HttpError } from './http'
import { initialPlayer, initialPuzzle, settingsOf, type Model, type Settings } from './ratingModel'
import catalog from './catalog.json'

const modelQuery = 'SELECT * FROM rating_models WHERE active=1'
const modelIdQuery = '(SELECT id FROM rating_models WHERE active=1)'
const headQuery = '(SELECT watermark FROM rating_models WHERE active=1)'
const puzzlesQuery = `SELECT p.id, p.authored_seed, s.rating, s.rd, s.volatility,
  (SELECT COUNT(*) FROM results WHERE puzzle_id=p.id AND seq<=${headQuery}) games
  FROM puzzles p LEFT JOIN rating_state s ON s.puzzle_id=p.id AND s.model_id=${modelIdQuery}`

type CachedRating = Rating | { rating: null; rd: null; volatility: null }
type PuzzleRow = CachedRating & { id: string; authored_seed: number | null; games: number }
type RecentRow = Omit<RecentResult, 'won' | 'draw'>
type ProfileRow = Pick<Profile, 'id' | 'username' | 'createdAt' | 'games' | 'wins' | 'draws'> & {
  rating: number | null; rd: number | null
}
type HistoryRow = Omit<RecentRow, 'acceptedAt'> & { at: number; rating: number }

// D1 preserves statement order, but its batch generic uses one row type for
// every statement. Keep the ordered tuple assertion here, at the SQL boundary.
async function readBatch<Rows extends unknown[]>(
  db: D1Database,
  ...statements: { [Index in keyof Rows]: D1PreparedStatement }
) {
  return await db.batch(statements) as { [Index in keyof Rows]: D1Result<Rows[Index]> }
}

function puzzleRatings(settings: Settings, rows: PuzzleRow[]): PuzzleRating[] {
  const byId = new Map(rows.map(row => [row.id, row]))
  return catalog.map(({ id, levelId, title }) => {
    const row = byId.get(id)
    if (!row || row.authored_seed == null) throw new HttpError(503, 'Puzzle catalog needs initialization.')
    const state = row.rating === null ? initialPuzzle(settings, row.authored_seed) : {
      rating: row.rating, rd: row.rd, volatility: row.volatility,
    }
    return { id, levelId, title, ...state, games: row.games }
  })
}

function withOutcome(row: RecentRow): RecentResult {
  return { ...row, won: row.score === 1, draw: row.score === 0.5 }
}

export async function readRatings(db: D1Database, userId: string): Promise<GetResponses['ratings']> {
  const [models, player, puzzles, recent] = await readBatch<[Model, CachedRating & { games: number }, PuzzleRow, RecentRow]>(db,
    db.prepare(modelQuery),
    db.prepare(`SELECT s.rating,s.rd,s.volatility,(SELECT COUNT(*) FROM results WHERE user_id=? AND seq<=${headQuery}) games
      FROM (SELECT 1) LEFT JOIN rating_state s ON s.model_id=${modelIdQuery} AND s.user_id=?`).bind(userId, userId),
    db.prepare(puzzlesQuery),
    db.prepare(`SELECT r.id,r.puzzle_id puzzleId,p.level_id levelId,r.score,r.accepted_at acceptedAt
      FROM results r JOIN puzzles p ON p.id=r.puzzle_id WHERE r.user_id=? AND r.seq<=${headQuery} ORDER BY r.seq DESC LIMIT 8`).bind(userId),
  )
  const model = models.results[0]
  if (!model) throw new HttpError(503, 'Ratings are being prepared. Please retry shortly.')
  const settings = settingsOf(model)
  const row = player.results[0]
  const state = row.rating === null ? initialPlayer(settings) : { rating: row.rating, rd: row.rd, volatility: row.volatility }
  return {
    ratingModelId: model.id, userId, player: { ...state, games: row.games },
    puzzles: puzzleRatings(settings, puzzles.results), recent: recent.results.map(withOutcome),
  }
}

export async function readLeaderboard(db: D1Database, params: URLSearchParams): Promise<GetResponses['leaderboard']> {
  const rawOffset = params.get('offset') ?? '0'
  if (!/^\d{1,7}$/.test(rawOffset)) throw new HttpError(400, 'Invalid leaderboard page.')
  const offset = Number(rawOffset), limit = 50
  const [models, rows, total] = await readBatch<[Model, Omit<Leaderboard['entries'][number], 'rank'>, { total: number }]>(db,
    db.prepare(modelQuery),
    db.prepare(`SELECT u.id,u.username,s.rating,s.rd,(SELECT COUNT(*) FROM results r WHERE r.user_id=u.id AND r.seq<=${headQuery}) games
      FROM rating_state s JOIN users u ON u.id=s.user_id WHERE s.model_id=${modelIdQuery} AND u.username IS NOT NULL
      ORDER BY s.rating DESC,games DESC,u.username COLLATE NOCASE,u.id LIMIT ? OFFSET ?`).bind(limit, offset),
    db.prepare(`SELECT COUNT(*) total FROM rating_state s JOIN users u ON u.id=s.user_id WHERE s.model_id=${modelIdQuery} AND u.username IS NOT NULL`),
  )
  const model = models.results[0]
  if (!model) throw new HttpError(503, 'Ratings are being prepared.')
  return {
    ratingModelId: model.id, entries: rows.results.map((row, index) => ({ ...row, rank: offset + index + 1 })),
    total: total.results[0].total, offset, limit,
  }
}

export async function readPuzzles(db: D1Database): Promise<GetResponses['puzzles']> {
  const [models, rows] = await readBatch<[Model, PuzzleRow]>(db, db.prepare(modelQuery), db.prepare(puzzlesQuery))
  const model = models.results[0]
  if (!model) throw new HttpError(503, 'Puzzle ratings are being prepared.')
  return { ratingModelId: model.id, puzzles: puzzleRatings(settingsOf(model), rows.results) }
}

export async function readProfile(db: D1Database, userId: string): Promise<GetResponses['profile']> {
  const [models, stats, points] = await readBatch<[Model, ProfileRow, HistoryRow]>(db,
    db.prepare(modelQuery),
    db.prepare(`SELECT u.id,u.username,u.created_at createdAt,s.rating,s.rd,
      (SELECT COUNT(*) FROM results WHERE user_id=u.id AND seq<=${headQuery}) games,
      (SELECT COALESCE(SUM(score=1),0) FROM results WHERE user_id=u.id AND seq<=${headQuery}) wins,
      (SELECT COUNT(*) FROM results WHERE user_id=u.id AND score=0.5 AND seq<=${headQuery}) draws
      FROM users u LEFT JOIN rating_state s ON s.user_id=u.id AND s.model_id=${modelIdQuery} WHERE u.id=?`).bind(userId),
    db.prepare(`SELECT r.id,r.puzzle_id puzzleId,p.level_id levelId,r.score,r.accepted_at at,h.rating
      FROM rating_history h JOIN results r ON r.seq=h.result_seq JOIN puzzles p ON p.id=r.puzzle_id
      WHERE h.model_id=${modelIdQuery} AND h.user_id=? ORDER BY r.seq`).bind(userId),
  )
  const model = models.results[0]
  if (!model) throw new HttpError(503, 'Ratings are being prepared.')
  const settings = settingsOf(model)
  const profile = stats.results[0]
  const catalogById = new Map(catalog.map(puzzle => [puzzle.id, puzzle]))
  const results = [...points.results].reverse().map(({ at, rating, ...row }) => {
    const puzzle = catalogById.get(row.puzzleId)
    return {
      ...withOutcome({ ...row, acceptedAt: at }),
      title: puzzle?.title ?? row.levelId, previewLevelId: puzzle?.levelId, rating,
    }
  })
  return {
    ...profile,
    rating: profile.rating ?? settings.initialRating, rd: profile.rd ?? settings.playerRd,
    ratingModelId: model.id, initialRating: settings.initialRating,
    history: [{ id: 'initial', at: profile.createdAt, rating: settings.initialRating },
      ...points.results.map(({ id, at, rating }) => ({ id, at, rating }))],
    results, olderResultsMissing: 0,
  }
}
