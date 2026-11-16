import { DEFAULT_SETTINGS, settingsOf, initialPlayer, initialPuzzle, calculate, stateWrite, guard, type Model, type Settings } from './ratingModel.ts'
import type { Rating } from '../src/ratings/glicko.ts'

export async function pause(db: D1Database) {
  await db.prepare('UPDATE rating_models SET paused=1 WHERE active=1').run()
}
export async function createModel(db: D1Database, id: string, settings: Settings = DEFAULT_SETTINGS) {
  settingsOf({ settings:JSON.stringify(settings) } as Model)
  await db.batch([
    db.prepare('UPDATE rating_models SET paused=1 WHERE active=1'),
    db.prepare('INSERT INTO rating_models(id,settings,created_at) VALUES(?,?,?)').bind(id,JSON.stringify(settings),Date.now()),
  ])
}
export async function replayPage(db: D1Database, id: string, limit=25) {
  if (!Number.isInteger(limit) || limit<1 || limit>25) throw new Error('Replay pages must contain 1–25 results')
  const model=await db.prepare('SELECT * FROM rating_models WHERE id=?').bind(id).first<Model>()
  if (!model || model.active || model.status!=='building') throw new Error('Candidate must be inactive and building')
  const settings=settingsOf(model)
  const page=await db.prepare('SELECT r.*,p.authored_seed FROM results r JOIN puzzles p ON p.id=r.puzzle_id WHERE r.seq>? ORDER BY r.seq LIMIT ?').bind(model.watermark,limit).all<{seq:number;user_id:string;puzzle_id:string;score:number;authored_seed:number}>()
  if (!page.results.length) return false
  const players=new Map<string,Rating>(), puzzles=new Map<string,Rating>(), writes:D1PreparedStatement[]=[guard(db,model,true)]
  const users=[...new Set(page.results.map(r=>r.user_id))], levels=[...new Set(page.results.map(r=>r.puzzle_id))]
  const states=await db.prepare(`SELECT * FROM rating_state WHERE model_id=? AND (user_id IN (${users.map(()=>'?').join(',')}) OR puzzle_id IN (${levels.map(()=>'?').join(',')}))`).bind(id,...users,...levels).all<Rating & {user_id:string|null;puzzle_id:string|null}>()
  for (const state of states.results) {
    if (state.user_id) players.set(state.user_id,state)
    if (state.puzzle_id) puzzles.set(state.puzzle_id,state)
  }
  for (const r of page.results) {
    if (r.authored_seed==null) throw new Error(`Missing immutable seed: ${r.puzzle_id}`)
    const player=players.get(r.user_id)??initialPlayer(settings)
    const puzzle=puzzles.get(r.puzzle_id)??initialPuzzle(settings,r.authored_seed)
    const next=calculate(settings,player,puzzle,r.score)
    players.set(r.user_id,next.player); puzzles.set(r.puzzle_id,next.level)
    writes.push(db.prepare('INSERT INTO rating_history(model_id,result_seq,user_id,rating) VALUES(?,?,?,?)').bind(id,r.seq,r.user_id,next.player.rating))
  }
  for (const [key,value] of players) writes.push(stateWrite(db,id,'user',key,value))
  for (const [key,value] of puzzles) writes.push(stateWrite(db,id,'puzzle',key,value))
  writes.push(db.prepare('UPDATE rating_models SET watermark=? WHERE id=?').bind(page.results.at(-1)!.seq,id))
  await db.batch(writes)
  return true
}
export async function validateModel(db: D1Database, id: string) {
  const checks=await db.prepare(`SELECT
    m.watermark=(SELECT COALESCE(MAX(seq),0) FROM results) at_head,
    (SELECT COUNT(*) FROM rating_history WHERE model_id=m.id)=(SELECT COUNT(*) FROM results) complete,
    NOT EXISTS(SELECT 1 FROM results r LEFT JOIN rating_history h ON h.model_id=m.id AND h.result_seq=r.seq WHERE h.user_id IS NULL OR h.user_id<>r.user_id) participants,
    NOT EXISTS(SELECT 1 FROM rating_state s WHERE s.model_id=m.id AND s.user_id IS NOT NULL AND s.rating<>(SELECT h.rating FROM rating_history h WHERE h.model_id=m.id AND h.user_id=s.user_id ORDER BY h.result_seq DESC LIMIT 1)) endpoints,
    (SELECT COUNT(*) FROM rating_state WHERE model_id=m.id AND user_id IS NOT NULL)=(SELECT COUNT(DISTINCT user_id) FROM results) players,
    (SELECT COUNT(*) FROM rating_state WHERE model_id=m.id AND puzzle_id IS NOT NULL)=(SELECT COUNT(DISTINCT puzzle_id) FROM results) puzzles
    FROM rating_models m WHERE m.id=?`).bind(id).first<Record<string,number>>()
  if (!checks || Object.values(checks).some(v=>v!==1)) throw new Error(`Incomplete model: ${JSON.stringify(checks)}`)
}
export async function activate(db: D1Database, id: string) {
  await validateModel(db,id)
  // The final guard repeats completeness at commit time. Resuming play or a
  // competing rebuild between validation and activation makes the batch fail.
  await db.batch([
    db.prepare(`UPDATE rating_models SET watermark=CASE WHEN active=0 AND paused=1 AND watermark=(SELECT COALESCE(MAX(seq),0) FROM results) AND (SELECT COUNT(*) FROM rating_history WHERE model_id=?)=(SELECT COUNT(*) FROM results) AND NOT EXISTS(SELECT 1 FROM rating_models WHERE active=1 AND paused=0) THEN watermark ELSE NULL END WHERE id=?`).bind(id,id),
    db.prepare('UPDATE rating_models SET active=0,paused=1 WHERE active=1'),
    db.prepare("UPDATE rating_models SET active=1,paused=0,status='ready' WHERE id=?").bind(id),
  ])
}
// Rollback is catch-up replay, never simply reactivating an old watermark.
export async function resumeModel(db: D1Database,id:string) {
  const model=await db.prepare('SELECT * FROM rating_models WHERE id=?').bind(id).first<Model>()
  if (!model || model.active) throw new Error('Choose an inactive model to resume or roll back')
  await db.batch([
    db.prepare('UPDATE rating_models SET paused=1 WHERE active=1'),
    db.prepare("UPDATE rating_models SET status='building',paused=1,watermark=CASE WHEN active=0 THEN watermark ELSE NULL END WHERE id=?").bind(id),
  ])
}
