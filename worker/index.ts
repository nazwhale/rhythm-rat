import { randomUsername } from './usernames'
import { loginEmail } from './loginEmail'
import type { Rating } from '../src/ratings/glicko'
import { activeModel, settingsOf, initialPlayer, initialPuzzle, calculate, stateWrite, guard } from './ratingModel'
import catalog from './catalog.json'

type Env = { DB: D1Database; ASSETS: Fetcher; EMAIL: { sendEmail(message: { to: string; subject: string; text: string; html?: string }): Promise<{ id: string }> }; AUTH_SECRET: string; LOCAL_EMAIL?: string }
type User = { id: string; email: string; username: string }
type Puzzle = { id: string; level_id: string; authored_seed: number }
type Result = { id: string; user_id: string; puzzle_id: string; score: number }
const YEAR = 365 * 24 * 60 * 60
const encoder = new TextEncoder()
class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }
const json = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('')
const hash = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
async function codeHash(env: Env, email: string, code: string) {
  if (!env.AUTH_SECRET) throw new HttpError(503, 'Email login is not configured yet.')
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${email}:${code}`)))
}
function cookie(value: string, request: Request, maxAge = YEAR) {
  return `rr_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
async function ensureUsername(env: Env, user: User) {
  if (user.username) return user
  // Covers a signup handled by the previous Worker during an additive migration.
  for (let tries = 0; tries < 8; tries++) {
    const name = randomUsername() + (tries >= 3 ? crypto.randomUUID().slice(0, 6) : '')
    try {
      await env.DB.prepare('UPDATE users SET username=? WHERE id=? AND username IS NULL').bind(name, user.id).run()
      return (await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first<User>())!
    } catch (error) { if (tries === 7 || !/UNIQUE constraint failed: users.username/.test(String(error))) throw error }
  }
  return user
}
async function session(request: Request, env: Env) {
  const value = request.headers.get('Cookie')?.match(/(?:^|;\s*)rr_session=([a-f0-9]{64})(?:;|$)/)?.[1]
  if (!value) return null
  const digest = await hash(value)
  const user = await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(digest, Date.now()).first<User>()
  return user ? { user: await ensureUsername(env, user), digest, value } : null
}
async function body(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.')
  const raw = await request.text()
  if (raw.length > 4096) throw new HttpError(413, 'Request is too large.')
  try { const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string, unknown> }
  catch { throw new HttpError(400, 'Invalid JSON.') }
}
function emailOf(value: unknown) {
  if (typeof value !== 'string') throw new HttpError(400, 'Enter your email address.')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  return email
}
const modelQuery = 'SELECT * FROM rating_models WHERE active=1'
const modelIdQuery = '(SELECT id FROM rating_models WHERE active=1)'
const headQuery = '(SELECT watermark FROM rating_models WHERE active=1)'
const puzzlesQuery = `SELECT p.*,s.rating cached_rating,s.rd,s.volatility,(SELECT COUNT(*) FROM results WHERE puzzle_id=p.id AND seq<=${headQuery}) games FROM puzzles p LEFT JOIN rating_state s ON s.puzzle_id=p.id AND s.model_id=${modelIdQuery}`
function puzzleRatings(settings: import('./ratingModel').Settings, rows: Record<string,string|number|null>[]) {
  return catalog.map(c => {
    const p = rows.find(p => p.id === c.id)
    if (!p || p.authored_seed == null) throw new HttpError(503, 'Puzzle catalog needs initialization.')
    const state = p.cached_rating == null ? initialPuzzle(settings, Number(p.authored_seed)) : { rating:p.cached_rating,rd:p.rd,volatility:p.volatility }
    return { id:c.id,levelId:c.levelId,title:c.title,...state,games:p.games }
  })
}
async function ratings(env: Env, user: User) {
  const [models, player, puzzles, recent] = await env.DB.batch<Record<string, string | number | null>>([
    env.DB.prepare(modelQuery),
    env.DB.prepare(`SELECT s.*,(SELECT COUNT(*) FROM results WHERE user_id=? AND seq<=${headQuery}) games FROM (SELECT 1) LEFT JOIN rating_state s ON s.model_id=${modelIdQuery} AND s.user_id=?`).bind(user.id,user.id),
    env.DB.prepare(puzzlesQuery),
    env.DB.prepare(`SELECT r.id,r.puzzle_id puzzleId,p.level_id levelId,r.score,r.accepted_at acceptedAt FROM results r JOIN puzzles p ON p.id=r.puzzle_id WHERE r.user_id=? AND r.seq<=${headQuery} ORDER BY r.seq DESC LIMIT 8`).bind(user.id),
  ])
  const model = models.results[0] as unknown as import('./ratingModel').Model
  if (!model) throw new HttpError(503, 'Ratings are being prepared. Please retry shortly.')
  const settings = settingsOf(model), p = player.results[0]
  return { ratingModelId: model.id, userId: user.id, player: { ...(p.rating == null ? initialPlayer(settings) : { rating:p.rating,rd:p.rd,volatility:p.volatility }), games:p.games }, puzzles: puzzleRatings(settings, puzzles.results), recent: recent.results.map(r => ({ ...r, won:r.score===1, draw:r.score===0.5 })) }
}
async function submit(env: Env, user: User, data: Record<string, unknown>) {
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
async function api(request: Request, env: Env) {
  const path = new URL(request.url).pathname
  if (request.method === 'POST') {
    const origin = request.headers.get('Origin')
    if (origin !== new URL(request.url).origin) throw new HttpError(403, 'Use the game website to make this request.')
  }
  if (path === '/api/auth/code' && request.method === 'POST') {
    const email = emailOf((await body(request)).email)
    const now = Date.now()
    // Rejection sampling avoids modulo bias for four-digit codes.
    let n: number
    do { n = crypto.getRandomValues(new Uint16Array(1))[0] } while (n >= 60000)
    const code = String(n % 10000).padStart(4, '0')
    const digest = await codeHash(env, email, code)
    const saved = await env.DB.prepare('INSERT INTO login_codes(email,code_hash,expires_at,guesses,resend_at) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,guesses=0,resend_at=excluded.resend_at WHERE login_codes.resend_at<=? RETURNING email').bind(email, digest, now + 600000, now + 60000, now).first()
    if (!saved) throw new HttpError(429, 'Wait 60 seconds before requesting another code.')
    try {
      if (env.LOCAL_EMAIL === 'true') console.log(`LOCAL LOGIN ${email}: ${code}`)
      else await env.EMAIL.sendEmail({ to: email, ...loginEmail(code) })
    } catch {
      await env.DB.prepare('DELETE FROM login_codes WHERE email=? AND code_hash=?').bind(email, digest).run()
      throw new HttpError(502, 'Could not send your code. Please try again.')
    }
    return json({ sent: true })
  }
  if (path === '/api/auth/verify' && request.method === 'POST') {
    const data = await body(request), email = emailOf(data.email)
    if (typeof data.code !== 'string' || !/^\d{4}$/.test(data.code)) throw new HttpError(400, 'Enter the four-digit code.')
    const digest = await codeHash(env, email, data.code), now = Date.now()
    // Count and compare in one write; concurrent guesses cannot bypass the limit.
    const attempt = await env.DB.prepare('UPDATE login_codes SET guesses=guesses+1 WHERE email=? AND expires_at>? AND guesses<5 RETURNING code_hash,guesses').bind(email, now).first<{ code_hash: string; guesses: number }>()
    if (!attempt || attempt.code_hash !== digest) throw new HttpError(400, 'Incorrect or expired code. Request another code if needed.')
    const consumed = await env.DB.prepare('DELETE FROM login_codes WHERE email=? AND code_hash=? AND expires_at>? RETURNING email').bind(email, digest, now).first()
    if (!consumed) throw new HttpError(400, 'Code already used. Request another code.')
    const value = token(), sessionHash = await hash(value)
    for (let tries = 0; ; tries++) {
      const username = randomUsername() + (tries >= 3 ? crypto.randomUUID().slice(0, 6) : '')
      try {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO users(id,email,username,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(), email, username, now),
          env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) SELECT ?,id,? FROM users WHERE email=?').bind(sessionHash, now + YEAR * 1000, email),
        ])
        break
      } catch (error) {
        if (tries >= 7 || !/UNIQUE constraint failed: users.username/.test(String(error))) throw error
      }
    }
    const account = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first<User>()
    const named = await ensureUsername(env, account!)
    const user = { id: named.id, email: named.email, username: named.username }
    return json({ user }, 200, { 'Set-Cookie': cookie(value, request) })
  }
  const auth = await session(request, env)
  if (path === '/api/me' && request.method === 'GET') {
    if (!auth) return json({ user: null })
    await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').bind(Date.now() + YEAR * 1000, auth.digest).run()
    return json({ user: { id: auth.user.id, email: auth.user.email, username: auth.user.username } }, 200, { 'Set-Cookie': cookie(auth.value, request) })
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    if (auth) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(auth.digest).run()
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', request, 0) })
  }
  if (path === '/api/leaderboard' && request.method === 'GET') {
    const rawOffset = new URL(request.url).searchParams.get('offset') ?? '0'
    if (!/^\d{1,7}$/.test(rawOffset)) throw new HttpError(400, 'Invalid leaderboard page.')
    const offset = Number(rawOffset), limit = 50
    const [models,rows,total] = await env.DB.batch<Record<string, string | number | null>>([
      env.DB.prepare(modelQuery),
      env.DB.prepare(`SELECT u.id,u.username,s.rating,s.rd,(SELECT COUNT(*) FROM results r WHERE r.user_id=u.id AND r.seq<=${headQuery}) games FROM rating_state s JOIN users u ON u.id=s.user_id WHERE s.model_id=${modelIdQuery} AND u.username IS NOT NULL ORDER BY s.rating DESC,games DESC,u.username COLLATE NOCASE,u.id LIMIT ? OFFSET ?`).bind(limit,offset),
      env.DB.prepare(`SELECT COUNT(*) total FROM rating_state s JOIN users u ON u.id=s.user_id WHERE s.model_id=${modelIdQuery} AND u.username IS NOT NULL`),
    ])
    const model=models.results[0]
    if (!model) throw new HttpError(503,'Ratings are being prepared.')
    return json({ ratingModelId:model.id,entries:rows.results.map((r,i)=>({...r,rank:offset+i+1})),total:total.results[0].total,offset,limit })
  }
  if (path === '/api/puzzles' && request.method === 'GET') {
    const [models,rows]=await env.DB.batch<Record<string,string|number|null>>([env.DB.prepare(modelQuery),env.DB.prepare(puzzlesQuery)])
    const model=models.results[0] as unknown as import('./ratingModel').Model
    if (!model) throw new HttpError(503,'Puzzle ratings are being prepared.')
    return json({ratingModelId:model.id,puzzles:puzzleRatings(settingsOf(model),rows.results)})
  }
  if (!auth) throw new HttpError(401,'Sign in to save rated runs.')
  if (path === '/api/profile' && request.method === 'GET') {
    const [models,stats,points] = await env.DB.batch<Record<string, string | number | null>>([
      env.DB.prepare(modelQuery),
      env.DB.prepare(`SELECT u.id,u.username,u.created_at createdAt,s.rating,s.rd,(SELECT COUNT(*) FROM results WHERE user_id=u.id AND seq<=${headQuery}) games,(SELECT COALESCE(SUM(score=1),0) FROM results WHERE user_id=u.id AND seq<=${headQuery}) wins,(SELECT COUNT(*) FROM results WHERE user_id=u.id AND score=0.5 AND seq<=${headQuery}) draws FROM users u LEFT JOIN rating_state s ON s.user_id=u.id AND s.model_id=${modelIdQuery} WHERE u.id=?`).bind(auth.user.id),
      env.DB.prepare(`SELECT r.id,r.puzzle_id puzzleId,p.level_id levelId,r.score,r.accepted_at at,h.rating FROM rating_history h JOIN results r ON r.seq=h.result_seq JOIN puzzles p ON p.id=r.puzzle_id WHERE h.model_id=${modelIdQuery} AND h.user_id=? ORDER BY r.seq`).bind(auth.user.id),
    ])
    const model=models.results[0] as unknown as import('./ratingModel').Model
    if (!model) throw new HttpError(503,'Ratings are being prepared.')
    const settings=settingsOf(model), profile=stats.results[0]
    const results = [...points.results].reverse().map(row => {
      const puzzle = catalog.find(entry => entry.id === row.puzzleId)
      return {
        id: row.id, puzzleId: row.puzzleId, levelId: row.levelId,
        title: puzzle?.title ?? row.levelId, previewLevelId: puzzle?.levelId,
        score: row.score, won: row.score === 1, draw: row.score === 0.5,
        acceptedAt: row.at, rating: row.rating,
      }
    })
    return json({ ...profile,rating:profile.rating??settings.initialRating,rd:profile.rd??settings.playerRd,ratingModelId:model.id,initialRating:settings.initialRating,history:[{id:'initial',at:profile.createdAt,rating:settings.initialRating},...points.results.map(p=>({id:p.id,at:p.at,rating:p.rating}))],results,olderResultsMissing:0 })
  }
  if (path === '/api/profile' && request.method === 'POST') {
    const data = await body(request)
    const username = typeof data.username === 'string' ? data.username.trim() : ''
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) throw new HttpError(400, 'Use 3–32 letters, numbers, hyphens or underscores.')
    try { await env.DB.prepare('UPDATE users SET username=? WHERE id=?').bind(username, auth.user.id).run() }
    catch (error) {
      if (/UNIQUE constraint failed: users.username/.test(String(error))) throw new HttpError(409, 'That username is taken. Try another one.')
      throw error
    }
    return json({ username })
  }
  if (path === '/api/ratings' && request.method === 'GET') return json(await ratings(env, auth.user))
  if (path === '/api/results' && request.method === 'POST') return json(await submit(env, auth.user, await body(request)))
  throw new HttpError(404, 'API route not found.')
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try { return await api(request, env) }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error('API failure', error instanceof Error ? error.message : 'Unknown error')
      return json({ error: 'Something went wrong. Please retry.' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
