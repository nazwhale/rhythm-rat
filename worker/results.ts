import type { OnlineUser, PostResponse } from '../src/shared/apiContract'
import type { Rating } from '../src/ratings/glicko'
import { activeModel, settingsOf, initialPlayer, initialPuzzle, calculate, stateWrite, guard } from './ratingModel'
import { HttpError, type Env } from './http'

type Puzzle = { id: string; level_id: string; authored_seed: number }
type Result = { id: string; user_id: string; puzzle_id: string; score: number }
export async function submit(env: Env, user: OnlineUser, data: Record<string, unknown>): Promise<PostResponse<'results'>> {
  if (data.userId !== undefined && data.userId !== user.id) throw new HttpError(401,'Sign in to the account that played this run.')
  const score = data.score === undefined && typeof data.won === 'boolean' ? (data.won ? 1 : 0) : data.score
  if (typeof data.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.id) || typeof data.puzzleId !== 'string' || typeof score !== 'number' || ![0,0.5,1].includes(score)) throw new HttpError(400, 'Invalid result.')
  const id=data.id, puzzleId=data.puzzleId
  for (let tries=0; tries<3; tries++) {
    const model = await activeModel(env.DB)
    if (!model) throw new HttpError(503, 'Ratings are being prepared. Your result will retry.')
    const existing = await env.DB.prepare('SELECT * FROM results WHERE id=?').bind(id).first<Result>()
    if (existing) {
      if (existing.user_id!==user.id || existing.puzzle_id!==puzzleId || existing.score!==score) throw new HttpError(409,'This run ID was already used for another result.')
      return { duplicate:true,delta:null,ratingModelId:model.id }
    }
    if (model.paused || model.status!=='ready') throw new HttpError(503,'Ratings are being recalculated. Your result will retry.')
    const settings=settingsOf(model)
    const [playerRow,puzzle,puzzleRow] = await Promise.all([
      env.DB.prepare('SELECT rating,rd,volatility FROM rating_state WHERE model_id=? AND user_id=?').bind(model.id,user.id).first<Rating>(),
      env.DB.prepare('SELECT * FROM puzzles WHERE id=?').bind(puzzleId).first<Puzzle>(),
      env.DB.prepare('SELECT rating,rd,volatility FROM rating_state WHERE model_id=? AND puzzle_id=?').bind(model.id,puzzleId).first<Rating>(),
    ])
    if (!puzzle || puzzle.authored_seed==null) throw new HttpError(400,'Unknown puzzle version or missing seed.')
    const player=playerRow??initialPlayer(settings), next=calculate(settings,player,puzzleRow??initialPuzzle(settings,puzzle.authored_seed),score)
    try {
      await env.DB.batch([
        guard(env.DB,model),
        env.DB.prepare('INSERT INTO results(id,user_id,puzzle_id,score,accepted_at) VALUES(?,?,?,?,?)').bind(id,user.id,puzzleId,score,Date.now()),
        stateWrite(env.DB,model.id,'user',user.id,next.player),
        stateWrite(env.DB,model.id,'puzzle',puzzleId,next.level),
        env.DB.prepare('INSERT INTO rating_history(model_id,result_seq,user_id,rating) SELECT ?,seq,user_id,? FROM results WHERE id=?').bind(model.id,next.player.rating,id),
        env.DB.prepare('UPDATE rating_models SET watermark=(SELECT seq FROM results WHERE id=?) WHERE id=?').bind(id,model.id),
      ])
      return { duplicate:false,delta:next.player.rating-player.rating,ratingModelId:model.id,player:next.player,puzzle:next.level }
    } catch(error) {
      if (!/UNIQUE constraint failed: results.id|NOT NULL constraint failed: rating_models.watermark/.test(String(error))) throw error
    }
  }
  throw new HttpError(503,'Ratings are busy. Retry saving this result.')
}
