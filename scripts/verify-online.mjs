import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare'
import { holdRun, withAvailableRun } from '../src/ratings/runLock.ts'
import { rateMatch } from '../src/ratings/glicko.ts'
import { completedBite, startSecondBite } from '../src/ratings/ratedRun.ts'
import { createRatedRunController } from '../src/ratings/ratedRunController.ts'
import { createResultDelivery } from '../src/ratings/resultDelivery.ts'
import { createModel, replayPage, activate, validateModel, resumeModel, pause } from '../worker/rebuild.ts'
import { DEFAULT_SETTINGS, guard, stateWrite } from '../worker/ratingModel.ts'
import { RAT_WORDS, randomUsername } from '../worker/usernames.ts'
import { puzzleContent } from '../src/ratings/catalog.ts'
import { recommendIndex } from '../src/ratings/recommend.ts'
import { pendingResults, retainResult, removeResult } from '../src/ratings/outbox.ts'
let mf, db, directory, catalog
const origin = 'https://game.test'
async function request(path, data, cookie) {
  return mf.dispatchFetch(origin + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
}
async function sentCode(email) {
  const worker = await mf.getWorker('email')
  const mails = await (await worker.fetch('https://email.test')).json()
  return mails.filter(m => m.to === email).at(-1).subject.match(/^(\d{4}) is your Rhythm Rat sign-in code$/)[1]
}
async function login(email) {
  assert.equal((await request('auth/code', { email })).status, 200)
  const response = await request('auth/verify', { email, code: await sentCode(email) })
  assert.equal(response.status, 200)
  const cookie = response.headers.get('set-cookie').split(';')[0]
  const { user } = await response.json()
  return { cookie, user }
}
async function migrate(database, name) {
  const sql = (await readFile(`migrations/${name}`, 'utf8')).replace(/^--.*$/gm, '')
  for (const statement of (sql.includes('CREATE TRIGGER') ? sql.match(/CREATE TRIGGER[\s\S]*?END;/gi)??[] : sql.split(';')).map(s => s.trim()).filter(Boolean)) await database.prepare(statement).run()
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'rhythm-online-'))
  await build({ entryPoints: ['worker/index.ts'], outfile: join(directory, 'worker.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' })
  mf = new Miniflare(convertV4MiniflareOptions({ log: new Log(LogLevel.ERROR), workers: [
    { name: 'game', modules: true, script: await readFile(join(directory, 'worker.js'), 'utf8'), compatibilityDate: '2026-11-15', d1Databases: { DB: 'test-db', LEGACY: 'legacy-db' }, bindings: { AUTH_SECRET: 'integration-test-secret' }, serviceBindings: { EMAIL: 'email' } },
    { name: 'email', modules: true, compatibilityDate: '2026-11-15', script: `import { WorkerEntrypoint } from 'cloudflare:workers'; const mails=[]; export default class extends WorkerEntrypoint { async sendEmail(message) { if(message.to==='delivery-fail@example.com') throw new Error('Test delivery failure'); mails.push(message); return {id:crypto.randomUUID()} } async fetch() { return Response.json(mails) } }` },
  ] }))
  db = await mf.getD1Database('DB', 'game')
  for (const name of (await readdir('migrations')).filter(n => n.endsWith('.sql')).sort()) await migrate(db, name)
  catalog = JSON.parse(await readFile('worker/catalog.json', 'utf8'))
  for (const p of catalog) await db.prepare('INSERT INTO puzzles(id,level_id,rating,authored_seed) VALUES(?,?,?,?)').bind(p.id, p.levelId, p.seed, p.authoredSeed).run()
  await createModel(db,'initial')
  await activate(db,'initial')
  for (const sql of (await readFile('scripts/ratings-cleanup.sql','utf8')).split(';').filter(s=>s.trim())) await db.prepare(sql).run()
})
after(async () => { await mf?.dispose(); if (directory) await rm(directory, { recursive: true, force: true }) })

test('email codes, session persistence, renewal, single use and logout', async () => {
  assert.equal((await request('me')).status, 200)
  assert.equal((await request('ratings')).status, 401)
  const email = 'account@example.com'
  const { cookie, user } = await login(email)
  assert.equal(user.email, email)
  const me = await request('me', undefined, cookie)
  assert.deepEqual((await me.json()).user, user)
  const header = me.headers.get('set-cookie')
  for (const expected of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=31536000']) assert.ok(header.includes(expected))
  assert.equal((await request('auth/verify', { email, code: await sentCode(email) })).status, 400)
  assert.equal((await request('auth/logout', {}, cookie)).status, 200)
  assert.equal((await (await request('me', undefined, cookie)).json()).user, null)
})
test('expiry, guess limit, resend cooldown and code replacement', async () => {
  const email = 'codes@example.com'
  await request('auth/code', { email })
  const old = await sentCode(email)
  assert.equal((await request('auth/code', { email })).status, 429)
  const wrong = old === '0000' ? '0001' : '0000'
  await Promise.all(Array.from({ length: 7 }, () => request('auth/verify', { email, code: wrong })))
  assert.equal((await request('auth/verify', { email, code: old })).status, 400)
  assert.equal((await db.prepare('SELECT guesses FROM login_codes WHERE email=?').bind(email).first()).guesses, 5)
  await db.prepare('UPDATE login_codes SET resend_at=0 WHERE email=?').bind(email).run()
  assert.equal((await request('auth/code', { email })).status, 200)
  assert.equal((await db.prepare('SELECT guesses FROM login_codes WHERE email=?').bind(email).first()).guesses, 0)
  await db.prepare('UPDATE login_codes SET expires_at=0 WHERE email=?').bind(email).run()
  assert.equal((await request('auth/verify', { email, code: await sentCode(email) })).status, 400)
  // Deterministically mark a code as superseded rather than rely on random codes differing.
  await db.prepare("UPDATE login_codes SET code_hash='superseded',expires_at=? WHERE email=?").bind(Date.now() + 100000, email).run()
  assert.equal((await request('auth/verify', { email, code: old })).status, 400)
})
test('delivery failures allow retry and expired sessions require sign-in', async () => {
  assert.equal((await request('auth/code', { email: 'delivery-fail@example.com' })).status, 502)
  assert.equal(await db.prepare('SELECT * FROM login_codes WHERE email=?').bind('delivery-fail@example.com').first(), null)
  const account = await login('expiry@example.com')
  await db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').bind(account.user.id).run()
  assert.equal((await (await request('me', undefined, account.cookie)).json()).user, null)
  assert.equal((await request('results', { id: crypto.randomUUID(), puzzleId: catalog[0].id, won: false }, account.cookie)).status, 401)
})
test('concurrent verification consumes one code once', async () => {
  const email = 'single@example.com'
  await request('auth/code', { email })
  const code = await sentCode(email)
  const responses = await Promise.all([request('auth/verify', { email, code }), request('auth/verify', { email, code })])
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400])
})
test('both rating updates, idempotency, payload conflicts and account isolation', async () => {
  const a = await login('player-a@example.com'), b = await login('player-b@example.com')
  const puzzle = catalog[0]
  const prior = {rating:puzzle.seed}
  const result = { id: crypto.randomUUID(), puzzleId: puzzle.id, won: true }
  const responses = await Promise.all([request('results', result, a.cookie), request('results', result, a.cookie)])
  assert.ok(responses.every(r => r.status === 200))
  assert.deepEqual((await Promise.all(responses.map(r => r.json()))).map(r => r.duplicate).sort(), [false, true])
  const player = await db.prepare("SELECT * FROM rating_state WHERE model_id='initial' AND user_id=?").bind(a.user.id).first()
  const updated = await db.prepare("SELECT * FROM rating_state WHERE model_id='initial' AND puzzle_id=?").bind(puzzle.id).first()
  assert.ok(player.rating > 1000 && updated.rating < prior.rating)
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM rating_history WHERE model_id='initial' AND user_id=?").bind(a.user.id).first()).n,1)
  assert.equal((await request('results', { ...result, won: false }, a.cookie)).status, 409)
  assert.equal((await request('results', result, b.cookie)).status, 409)
  assert.equal((await request('results',{id:crypto.randomUUID(),puzzleId:puzzle.id,score:1,userId:a.user.id},b.cookie)).status,401)
  const snapshot = await (await request('ratings', undefined, a.cookie)).json()
  assert.equal(snapshot.player.games, 1)
  assert.equal(snapshot.recent[0].won, true)
  assert.equal(snapshot.puzzles.length, catalog.length)
  // A lost response can be replayed after a new session / browser visit.
  assert.equal((await (await request('results', result, a.cookie)).json()).duplicate, true)
})
test('another browser session sees the same account and learned rating', async () => {
  const first = await login('two-browsers@example.com')
  await request('results', { id: crypto.randomUUID(), puzzleId: catalog[3].id, won: true }, first.cookie)
  const before = await (await request('ratings', undefined, first.cookie)).json()
  await request('auth/code', { email: first.user.email })
  await db.prepare('UPDATE login_codes SET resend_at=0 WHERE email=?').bind(first.user.email).run()
  const second = await login(first.user.email)
  assert.equal(second.user.id, first.user.id)
  assert.notEqual(second.cookie, first.cookie)
  const after = await (await request('ratings', undefined, second.cookie)).json()
  assert.deepEqual(after.player, before.player)
  await request('auth/logout', {}, first.cookie)
  assert.equal((await request('ratings', undefined, second.cookie)).status, 200)
})
test('simultaneous users and same-account runs preserve all accepted results', async () => {
  const a = await login('race-a@example.com'), b = await login('race-b@example.com')
  const puzzle = catalog[1]
  const tasks = [a, b, a].map((account, i) => ({ account, result: { id: crypto.randomUUID(), puzzleId: puzzle.id, won: i !== 1 } }))
  const responses = await Promise.all(tasks.map(t => request('results', t.result, t.account.cookie)))
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].status === 503) responses[i] = await request('results', tasks[i].result, tasks[i].account.cookie)
    assert.equal(responses[i].status, 200, await responses[i].text())
  }
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM results WHERE user_id=?').bind(a.user.id).first()).n,2)
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM results WHERE puzzle_id=?').bind(puzzle.id).first()).n, 3)
  const profile = await (await request('profile', undefined, a.cookie)).json()
  assert.equal(profile.history.length, 3)
  assert.equal(profile.history.at(-1).rating, profile.rating)
})
test('stale watermark rolls back a result, cache updates and graph point', async () => {
  const account=await login('rollback@example.com'), puzzle=catalog[2], id=crypto.randomUUID()
  const model=await db.prepare("SELECT * FROM rating_models WHERE active=1").first()
  await assert.rejects(db.batch([
    db.prepare('INSERT INTO results(id,user_id,puzzle_id,score,accepted_at) VALUES(?,?,?,?,?)').bind(id,account.user.id,puzzle.id,1,Date.now()),
    stateWrite(db,model.id,'user',account.user.id,{rating:999,rd:100,volatility:.06}),
    db.prepare('INSERT INTO rating_history(model_id,result_seq,user_id,rating) SELECT ?,seq,?,999 FROM results WHERE id=?').bind(model.id,account.user.id,id),
    guard(db,{...model,watermark:-1}),
  ]))
  assert.equal(await db.prepare('SELECT * FROM results WHERE id=?').bind(id).first(),null)
  assert.equal(await db.prepare('SELECT * FROM rating_state WHERE user_id=?').bind(account.user.id).first(),null)
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM rating_history WHERE user_id=?').bind(account.user.id).first()).n,0)
})
test('invalid input and cross-origin writes are rejected', async () => {
  assert.equal((await request('auth/code', { email: 'broken' })).status, 400)
  assert.equal((await mf.dispatchFetch(origin + '/api/auth/code', { method: 'POST', headers: { Origin: 'https://other.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'someone@example.com' }) })).status, 403)
  const account = await login('invalid@example.com')
  assert.equal((await request('results', { id: crypto.randomUUID(), puzzleId: 'missing', won: true }, account.cookie)).status, 400)
})
test('content identity, recommendation and durable account-scoped outbox', async () => {
  const level = JSON.parse(await readFile('src/levels/the-first-lap.json', 'utf8'))
  assert.equal(puzzleContent(level), puzzleContent({ ...level, title: 'Renamed', rating: 1 }))
  assert.notEqual(puzzleContent(level), puzzleContent({ ...level, bpm: 120 }))
  const memory = new Map()
  const storage = { get length() { return memory.size }, key: i => [...memory.keys()][i], getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) }
  const result = { id: 'run', userId: 'a', puzzleId: 'p', score: 0 }
  retainResult(storage, result)
  assert.deepEqual(pendingResults(storage, 'b'), [])
  assert.deepEqual(pendingResults(storage, 'a'), [result])
  removeResult(storage, result)
  assert.deepEqual(pendingResults(storage, 'a'), [])
  const rating = { rating: 1500, rd: 200, volatility: .06 }
  const candidates = [{ id: 'recent', rating }, { id: 'fresh', rating: { ...rating, rating: 1400 } }]
  assert.equal(recommendIndex(rating, candidates, ['recent']), 1)
  assert.equal(recommendIndex(rating, candidates, [], { easierThan: rating }), 1)
})

test('recommendations choose harder puzzles on 30% of regular rolls and use practice on recovery', () => {
  const player = { rating: 1750, rd: 100, volatility: 0.06 }
  const candidates = [
    { id: 'practice-center', rating: { ...player, rating: 1595 } },
    { id: 'practice-edge', rating: { ...player, rating: 1555 } },
    { id: 'even', rating: player },
    { id: 'stretch', rating: { ...player, rating: 1770 } },
  ]

  assert.equal(recommendIndex(player, candidates, [], { random: () => 0.55 }), 0)
  assert.equal(recommendIndex(player, candidates, [], { random: () => 0.9 }), 1)
  assert.equal(recommendIndex(player, candidates, [], { random: () => 0.299 }), 3)
  assert.equal(recommendIndex(player, candidates, [], { random: () => 0.30 }), 0)
  assert.equal(recommendIndex(player, candidates, ['stretch'], { random: () => 0 }), 3)
  assert.equal(recommendIndex(player, candidates.slice(0, 3), [], { random: () => 0 }), 0)
  assert.equal(recommendIndex(player, candidates, [], { easierThan: player, random: () => 0 }), 0)
})

test('profiles start at 1000, record exact post-result history once, and protect private data', async () => {
  assert.equal((await request('profile')).status, 401)
  const account = await login('profile@example.com')
  assert.ok(account.user.username.length >= 3)
  let profile = await (await request('profile', undefined, account.cookie)).json()
  assert.equal(profile.username, account.user.username)
  assert.equal(profile.history.length, 1)
  assert.equal(profile.history[0].rating, 1000)
  assert.equal(profile.games, 0)
  assert.equal(profile.olderResultsMissing, 0)
  const run = { id: crypto.randomUUID(), puzzleId: catalog[4].id, won: true }
  assert.equal((await request('results', run, account.cookie)).status, 200)
  const first = await (await request('profile', undefined, account.cookie)).json()
  assert.equal(first.history.length, 2)
  assert.equal(first.history[1].rating, first.rating)
  assert.equal(first.results[0].previewLevelId, catalog[4].levelId)
  await request('results', run, account.cookie)
  profile = await (await request('profile', undefined, account.cookie)).json()
  assert.deepEqual(profile.history, first.history)
  await request('results', { id: crypto.randomUUID(), puzzleId: catalog[5].id, won: false }, account.cookie)
  profile = await (await request('profile', undefined, account.cookie)).json()
  assert.equal(profile.games, 2)
  assert.equal(profile.wins, 1)
  assert.equal(profile.history.length, 3)
  assert.equal(profile.history.at(-1).rating, profile.rating)
  assert.ok(profile.history.every((p, i, all) => !i || p.at >= all[i - 1].at))
  assert.ok(!JSON.stringify(profile).includes(account.user.email))
  const other = await login('private-profile@example.com')
  assert.equal((await (await request('profile', undefined, other.cookie)).json()).games, 0)
})
test('usernames are editable, unique without case sensitivity, and validated', async () => {
  const a = await login('name-a@example.com'), b = await login('name-b@example.com')
  assert.equal((await request('profile', { username: '  CaptainWhisker  ' }, a.cookie)).status, 200)
  assert.equal((await (await request('me', undefined, a.cookie)).json()).user.username, 'CaptainWhisker')
  assert.equal((await request('profile', { username: 'captainwhisker' }, b.cookie)).status, 409)
  assert.equal((await request('profile', { username: 'ab' }, a.cookie)).status, 400)
  assert.equal((await request('profile', { username: 'x'.repeat(33) }, a.cookie)).status, 400)
  assert.equal((await request('profile', { username: '<script>' }, a.cookie)).status, 400)
  assert.equal((await request('profile', { username: 'CaptainWhisker' }, a.cookie)).status, 200)
  // A legacy signup with a null username is repaired without changing its identity.
  await db.prepare('UPDATE users SET username=NULL WHERE id=?').bind(b.user.id).run()
  const repaired = await (await request('me', undefined, b.cookie)).json()
  assert.ok(repaired.user.username)
  assert.equal(repaired.user.id, b.user.id)
})
test('leaderboard is public, ordered, paginated, and never exposes email', async () => {
  const response = await request('leaderboard')
  assert.equal(response.status, 200)
  const board = await response.json()
  assert.ok(board.entries.length)
  for (let i = 0; i < board.entries.length; i++) {
    const entry = board.entries[i]
    assert.equal(entry.rank, i + 1)
    assert.ok(entry.games > 0)
    assert.ok(entry.username)
    if (i) assert.ok(board.entries[i - 1].rating >= entry.rating)
    assert.deepEqual(Object.keys(entry).sort(), ['games', 'id', 'rank', 'rating', 'rd', 'username'])
  }
  assert.ok(!JSON.stringify(board).includes('@'))
  const second = await (await request('leaderboard?offset=1')).json()
  assert.equal(second.entries[0].id, board.entries[1].id)
  assert.equal(second.entries[0].rank, 2)
  assert.equal((await request('leaderboard?offset=-1')).status, 400)
  const zero = await db.prepare('SELECT id FROM users WHERE email=?').bind('name-a@example.com').first()
  assert.ok(!board.entries.some(e => e.id === zero.id))
})
test('legacy migration assigns names and preserves only the known latest rating', async () => {
  const legacy = await mf.getD1Database('LEGACY', 'game')
  await migrate(legacy, '0001_online.sql')
  await legacy.prepare('INSERT INTO users(id,email,rating,created_at) VALUES(?,?,?,?)').bind('old-user', 'old@example.com', 1623.5, 100).run()
  await legacy.prepare('INSERT INTO puzzles(id,level_id,rating) VALUES(?,?,?)').bind('p', 'p', 1500).run()
  for (let i = 0; i < 3; i++) await legacy.prepare('INSERT INTO results VALUES(?,?,?,?,?)').bind(`old-${i}`, 'old-user', 'p', 1, 200 + i).run()
  await migrate(legacy, '0002_profiles.sql')
  const user = await legacy.prepare('SELECT * FROM users').first()
  assert.ok(user.username)
  assert.equal(user.rating, 1623.5)
  const results = (await legacy.prepare('SELECT * FROM results ORDER BY accepted_at').all()).results
  assert.deepEqual(results.map(r => r.player_rating_after), [null, null, 1623.5])
  await migrate(legacy,'0003_replayable_ratings.sql')
  assert.deepEqual((await legacy.prepare('SELECT seq,id FROM results ORDER BY seq').all()).results,[{seq:1,id:'old-0'},{seq:2,id:'old-1'},{seq:3,id:'old-2'}])
  await migrate(legacy,'0004_immutable_rating_inputs.sql')
  await assert.rejects(legacy.prepare("INSERT INTO results(id,user_id,puzzle_id,won,accepted_at,player_rating_after) VALUES('old-writer','old-user','p',1,300,1600)").run())
  assert.equal((await legacy.prepare('SELECT COUNT(*) n FROM results').first()).n,3)
  await migrate(legacy,'0005_draw_results.sql')
  assert.deepEqual((await legacy.prepare('SELECT score FROM results ORDER BY seq').all()).results.map(r=>r.score),[1,1,1])


})
test('default names come from exactly 100 distinct rat-themed words', () => {
  assert.equal(RAT_WORDS.length, 100)
  assert.equal(new Set(RAT_WORDS).size, 100)
  for (let i = 0; i < 20; i++) {
    const name = randomUsername()
    assert.ok(RAT_WORDS.some(a => RAT_WORDS.some(b => a !== b && a + b === name)))
  }
})

async function finish(id) { while(await replayPage(db,id,3)) {} await validateModel(db,id) }
async function cache(id) { return (await db.prepare('SELECT user_id,puzzle_id,rating,rd,volatility FROM rating_state WHERE model_id=? ORDER BY user_id,puzzle_id').bind(id).all()).results }
test('replay equals incremental with tied dates; interrupted checkpoints, activation and rollback catch up safely', async () => {
  const original=await cache('initial')
  const facts=(await db.prepare('SELECT seq,id,user_id,puzzle_id,score,accepted_at FROM results ORDER BY seq').all()).results
  const seeds=(await db.prepare('SELECT id,authored_seed FROM puzzles ORDER BY id').all()).results
  await createModel(db,'replayed')
  assert.equal(await replayPage(db,'replayed',2),true)
  const checkpoint=await db.prepare("SELECT watermark FROM rating_models WHERE id='replayed'").first()
  assert.ok(checkpoint.watermark>0)
  await assert.rejects(activate(db,'replayed'))
  await resumeModel(db,'replayed')
  await finish('replayed')
  assert.deepEqual(await cache('replayed'),original)
  const account=await login('queued@example.com')
  const pending={id:crypto.randomUUID(),puzzleId:catalog[0].id,won:false}
  assert.equal((await request('results',pending,account.cookie)).status,503)
  await activate(db,'replayed')
  assert.equal((await request('results',pending,account.cookie)).status,200)
  const latest=await cache('replayed')
  await resumeModel(db,'initial')
  await finish('initial')
  await activate(db,'initial')
  assert.deepEqual(await cache('initial'),latest)
  assert.equal((await (await request('results',pending,account.cookie)).json()).duplicate,true)
  // A 1500 model uses the same immutable facts but changes every calculated curve.
  await createModel(db,'legacy-rules',{...DEFAULT_SETTINGS,initialRating:1500})
  await finish('legacy-rules')
  assert.notDeepEqual(await cache('legacy-rules'),latest)
  await activate(db,'legacy-rules')
  let profile=await (await request('profile',undefined,account.cookie)).json()
  assert.equal(profile.initialRating,1500)
  assert.equal(profile.history[0].rating,1500)
  await resumeModel(db,'initial'); await finish('initial'); await activate(db,'initial')
  profile=await (await request('profile',undefined,account.cookie)).json()
  assert.equal(profile.initialRating,1000)
  assert.equal(profile.ratingModelId,'initial')
  assert.equal(profile.history.at(-1).rating,profile.rating)
  assert.equal(profile.olderResultsMissing,0)
  assert.deepEqual((await db.prepare('SELECT seq,id,user_id,puzzle_id,score,accepted_at FROM results WHERE seq<=? ORDER BY seq').bind(facts.at(-1).seq).all()).results,facts)
  assert.deepEqual((await db.prepare('SELECT id,authored_seed FROM puzzles ORDER BY id').all()).results,seeds)
  // Identical timestamps still replay by the explicit sequence, never the date.
  await pause(db)
  await db.prepare('UPDATE results SET accepted_at=100').run()
  await createModel(db,'tied-dates')
  await finish('tied-dates')
  assert.deepEqual(await cache('tied-dates'),latest)
  await activate(db,'tied-dates')
})
test('subject constraints, unknown model settings and competing rebuilds fail atomically', async () => {
  await assert.rejects(db.prepare("INSERT INTO rating_state(model_id,rating,rd,volatility) VALUES('initial',1,1,.06)").run())
  const a=await login('guard@example.com')
  await assert.rejects(db.prepare("INSERT INTO rating_state(model_id,user_id,puzzle_id,rating,rd,volatility) VALUES('initial',?,?,1,1,.06)").bind(a.user.id,catalog[0].id).run())
  await assert.rejects(db.prepare("UPDATE rating_models SET settings='{}' WHERE id='initial'").run())
  await assert.rejects(db.prepare('UPDATE puzzles SET authored_seed=authored_seed+1 WHERE id=?').bind(catalog[0].id).run())
  await assert.rejects(createModel(db,'initial'))
  assert.equal((await db.prepare('SELECT paused FROM rating_models WHERE active=1').first()).paused,0)
  await assert.rejects(replayPage(db,'initial',26))
  await assert.rejects(createModel(db,'bad',{...DEFAULT_SETTINGS,tau:0}))
  await createModel(db,'racing-candidate')
  const responses=await Promise.allSettled([replayPage(db,'racing-candidate',2),replayPage(db,'racing-candidate',2)])
  assert.ok(responses.some(r=>r.status==='fulfilled'))
  await finish('racing-candidate')
  await activate(db,'racing-candidate')
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM rating_history WHERE model_id='racing-candidate'").first()).n,(await db.prepare('SELECT COUNT(*) n FROM results').first()).n)
})

test('draws update both subjects exactly once and replay with complete profile statistics', async () => {
  const account=await login('draw@example.com'), puzzle=catalog[8]
  const before=await (await request('ratings',undefined,account.cookie)).json()
  const run={id:crypto.randomUUID(),puzzleId:puzzle.id,score:0.5}
  const response=await request('results',run,account.cookie)
  assert.equal(response.status,200)
  const saved=await response.json()
  const expected=rateMatch(before.player,before.puzzles.find(p=>p.id===puzzle.id),0.5)
  assert.deepEqual(saved.player,expected.player)
  assert.deepEqual(saved.puzzle,expected.level)
  assert.equal((await (await request('results',run,account.cookie)).json()).duplicate,true)
  assert.equal((await request('results',{...run,score:0},account.cookie)).status,409)
  assert.equal((await request('results',{...run,id:crypto.randomUUID(),score:0.25},account.cookie)).status,400)
  const profile=await (await request('profile',undefined,account.cookie)).json()
  assert.equal(profile.draws,1);assert.equal(profile.wins,0);assert.equal(profile.games,1)
  assert.equal(profile.results.length,1);assert.equal(profile.results[0].draw,true);assert.equal(profile.results[0].title,puzzle.title)
  assert.equal(profile.history.at(-1).rating,expected.player.rating)
  const recent=await (await request('ratings',undefined,account.cookie)).json()
  assert.equal(recent.recent[0].draw,true);assert.equal(recent.recent[0].won,false)
  const current=await db.prepare('SELECT id FROM rating_models WHERE active=1').first()
  const original=await cache(current.id)
  await createModel(db,'with-draws');await finish('with-draws');await activate(db,'with-draws')
  assert.deepEqual(await cache('with-draws'),original)
})

test('two-bite lifecycle preserves one run ID, defers losses, and awards only a draw on retry', () => {
  const run=()=>({id:'same-id',userId:'u',puzzleId:'p',stage:'first'})
  const first=run();assert.equal(completedBite(first,true).score,1)
  const retry=run(), failure=completedBite(retry,false)
  assert.equal(failure.score,0);assert.equal(failure.deferred,true)
  assert.equal(completedBite(retry,false),null)
  assert.equal(startSecondBite(retry),true)
  assert.deepEqual(completedBite(retry,true),{id:'same-id',userId:'u',puzzleId:'p',score:0.5})
  const loss=run();completedBite(loss,false);startSecondBite(loss)
  assert.equal(completedBite(loss,false).score,0)
  assert.equal(startSecondBite(run()),false)
})

test('run locks protect deferred results until release, then allow recovery', async () => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'), held=new Set()
  const locks={async request(name,options,callback){
    if(typeof options==='function'){callback=options;options={}}
    if(held.has(name)){assert.equal(options.ifAvailable,true);return callback(null)}
    held.add(name)
    try{return await callback({name})}finally{held.delete(name)}
  }}
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}})
  try{
    const release=await holdRun('deferred')
    let saves=0
    await withAvailableRun('deferred',async()=>{saves++})
    assert.equal(saves,0)
    await release()
    await withAvailableRun('deferred',async()=>{saves++})
    assert.equal(saves,1)
  }finally{
    if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor)
    else delete globalThis.navigator
  }
})

test('rated run controller retains a deferred loss and releases the lock when leaving', async () => {
  const retained = []
  const events = []
  const runs = createRatedRunController(
    async id => async () => { events.push(`release:${id}`) },
    () => 'run-id',
    result => retained.push(result),
    () => events.push('flush'),
  )
  assert.equal(await runs.start('player', 'puzzle', () => true), true)
  runs.finish(false)
  assert.equal(retained[0].deferred, true)
  assert.deepEqual(events, [])
  assert.equal(runs.retry('another-player'), false)
  runs.abandon()
  await Promise.resolve()
  assert.deepEqual(retained[1], { id: 'run-id', userId: 'player', puzzleId: 'puzzle', score: 0 })
  assert.deepEqual(events, ['release:run-id', 'flush'])
})

test('result delivery checks the account and re-reads an upgraded result under its lock', async () => {
  const memory = new Map()
  const storage = {
    get length() { return memory.size },
    key: i => [...memory.keys()][i],
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key),
  }
  const result = { id: 'run-id', userId: 'player', puzzleId: 'puzzle', score: 0, deferred: true }
  let current = true
  let submitCount = 0
  const delivery = createResultDelivery({
    storage: () => storage,
    withAvailableRun: async (_id, save) => {
      if (!submitCount) delivery.retain({ ...result, score: 0.5, deferred: false })
      await save()
    },
    submit: async saved => {
      submitCount++
      assert.equal(saved.score, 0.5)
      if (submitCount === 1) throw new Error('Response lost')
      return { duplicate: true, delta: null, ratingModelId: 'current' }
    },
  })
  delivery.retain(result)
  delivery.retain({ ...result, id: 'other-run', userId: 'another-player' })
  const flush = () => delivery.deliver('player', () => current, () => {}, () => {})
  await assert.rejects(flush(), /Response lost/)
  assert.equal(pendingResults(storage, 'player')[0].score, 0.5)
  current = false
  await flush()
  assert.equal(submitCount, 1)
  current = true
  await flush()
  assert.equal(submitCount, 2)
  assert.equal(pendingResults(storage, 'player').length, 0)
  assert.equal(pendingResults(storage, 'another-player').length, 1)
})

test('a result retained in memory can still submit when browser storage is blocked', async () => {
  const ids = []
  const delivery = createResultDelivery({
    storage: () => { throw new Error('Storage unavailable') },
    withAvailableRun: async (_id, save) => save(),
    submit: async ({ id }) => {
      ids.push(id)
      return { duplicate: false, delta: 0, ratingModelId: 'current' }
    },
  })
  assert.equal(delivery.retain({ id: 'run-id', userId: 'player', puzzleId: 'puzzle', score: 1 }), false)
  await delivery.deliver('player', () => true, () => {}, () => {})
  assert.deepEqual(ids, ['run-id'])
})

test('public puzzle catalog matches the active recommendation cache and excludes account data', async () => {
  const response=await request('puzzles')
  assert.equal(response.status,200)
  const puzzles=await response.json()
  assert.equal(puzzles.puzzles.length,catalog.length)
  assert.ok(!JSON.stringify(puzzles).includes('@'))
  const account=await login('catalog@example.com')
  const ratings=await (await request('ratings',undefined,account.cookie)).json()
  assert.equal(puzzles.ratingModelId,ratings.ratingModelId)
  assert.deepEqual(puzzles.puzzles,ratings.puzzles)
  const profile=await (await request('profile',undefined,account.cookie)).json()
  assert.deepEqual(profile.results,[])
})
