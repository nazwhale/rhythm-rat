import { rateMatch, type Rating } from '../src/ratings/glicko.ts'

export const DEFAULT_SETTINGS = { algorithm: 'glicko2-v1', initialRating: 1000, playerRd: 350, puzzleOffset: 500, puzzleRd: 200, volatility: 0.06, tau: 0.5, period: 'one-result', inactivity: 'none' } as const
export type Settings = Omit<typeof DEFAULT_SETTINGS, 'initialRating' | 'playerRd' | 'puzzleOffset' | 'puzzleRd' | 'volatility' | 'tau'> & { initialRating: number; playerRd: number; puzzleOffset: number; puzzleRd: number; volatility: number; tau: number }
export type Model = { id: string; settings: string; active: number; paused: number; status: string; watermark: number }
export function settingsOf(model: Model): Settings {
  const s = JSON.parse(model.settings)
  if (s.algorithm !== 'glicko2-v1' || s.period !== 'one-result' || s.inactivity !== 'none' || !['initialRating','playerRd','puzzleOffset','puzzleRd','volatility','tau'].every(k => Number.isFinite(s[k])) || s.playerRd<=0 || s.puzzleRd<=0 || s.volatility<=0 || s.tau<=0) throw new Error('Unsupported rating settings')
  return s
}
export const initialPlayer = (s: Settings): Rating => ({ rating: s.initialRating, rd: s.playerRd, volatility: s.volatility })
export const initialPuzzle = (s: Settings, seed: number): Rating => ({ rating: seed + s.puzzleOffset, rd: s.puzzleRd, volatility: s.volatility })
export const calculate = (s: Settings, player: Rating, puzzle: Rating, score: boolean | number) => rateMatch(player, puzzle, score, s.tau)
export function stateWrite(db: D1Database, model: string, kind: 'user' | 'puzzle', id: string, value: Rating) {
  const key = `${kind}_id`
  return db.prepare(`INSERT INTO rating_state(model_id,${key},rating,rd,volatility) VALUES(?,?,?,?,?) ON CONFLICT(model_id,${key}) WHERE ${key} IS NOT NULL DO UPDATE SET rating=excluded.rating,rd=excluded.rd,volatility=excluded.volatility`).bind(model,id,value.rating,value.rd,value.volatility)
}
export const activeModel = (db: D1Database) => db.prepare('SELECT * FROM rating_models WHERE active=1').first<Model>()

// These assertions deliberately fail a NOT NULL constraint, when a retained model changes status. Models are never deleted during replay.
// A zero-row conditional UPDATE alone would not protect against stale state.
export function guard(db: D1Database, model: Model, rebuilding = false) {
  return db.prepare(`UPDATE rating_models SET watermark=CASE WHEN watermark=? AND ${rebuilding ? "active=0 AND paused=1 AND status='building' AND NOT EXISTS(SELECT 1 FROM rating_models WHERE active=1 AND paused=0)" : "active=1 AND paused=0 AND status='ready'"} THEN watermark ELSE NULL END WHERE id=?`).bind(model.watermark, model.id)
}
