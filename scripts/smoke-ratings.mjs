// Private deployment smoke check. Uses a short-lived admin-created session,
// removes it in finally, and never prints identities or session credentials.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
const preview=process.argv.includes('--preview'), write=process.argv.includes('--write-preview')
if(write&&!preview)throw new Error('Smoke-test outcome writes are only allowed on preview')
const environment=preview?'preview':'', origin=`https://rhythm-rat${preview?'-preview':''}.nazmalik08.workers.dev`
const quote=v=>"'"+String(v).replaceAll("'","''")+"'"
const query=sql=>JSON.parse(execFileSync('npx',['wrangler','d1','execute','DB','--remote','--env',environment,'--command',sql,'--json'],{encoding:'utf8',maxBuffer:8*1024*1024}))[0].results
if(write)query(`INSERT INTO users(id,email,username,created_at) VALUES(${quote(randomUUID())},'replay-smoke@example.invalid','ReplaySmokeRat',${Date.now()}) ON CONFLICT(email) DO NOTHING`)
const user=query(write?"SELECT id,username FROM users WHERE email='replay-smoke@example.invalid'":'SELECT id,username FROM users WHERE EXISTS(SELECT 1 FROM results WHERE user_id=users.id) LIMIT 1')[0]
assert.ok(user,'Need a played account for the smoke check')
const session=randomBytes(32).toString('hex'), digest=createHash('sha256').update(session).digest('hex')
query(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(${quote(digest)},${quote(user.id)},${Date.now()+300000})`)
const api=async(path,data)=>{
 const response=await fetch(origin+'/api/'+path,{method:data===undefined?'GET':'POST',headers:{Cookie:`rr_session=${session}`,Origin:origin,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})})
 assert.equal(response.status,200,`${path}: ${await response.clone().text()}`)
 return response.json()
}
try {
 if(write){
  const catalog=JSON.parse(await readFile(new URL('../worker/catalog.json',import.meta.url)))
  const result={id:randomUUID(),puzzleId:catalog[0].id,score:process.argv.includes('--draw')?0.5:0}
  const saved=await api('results',result)
  assert.equal(saved.duplicate,false);assert.ok(Number.isFinite(saved.delta))
  assert.ok(Number.isFinite(saved.player.rating)&&Number.isFinite(saved.puzzle.rating))
  assert.equal((await api('results',result)).duplicate,true)
 }
 const profile=await api('profile'),ratings=await api('ratings'),board=await api('leaderboard'),me=await api('me'),puzzles=await api('puzzles')
 if(write&&process.argv.includes('--draw'))assert.ok(profile.draws>0)
 assert.equal(profile.initialRating,1000)
 assert.equal(profile.history[0].rating,1000)
 assert.equal(profile.history.length,profile.games+1)
 assert.equal(profile.results.length,profile.games)
 assert.equal(puzzles.ratingModelId,profile.ratingModelId)
 assert.deepEqual(puzzles.puzzles,ratings.puzzles)
 assert.equal(profile.history.at(-1).rating,profile.rating)
 assert.equal(profile.olderResultsMissing,0)
 assert.equal(profile.rating,ratings.player.rating)
 assert.equal(profile.games,ratings.player.games)
 assert.equal(profile.ratingModelId,ratings.ratingModelId)
 assert.equal(profile.ratingModelId,board.ratingModelId)
 assert.equal(me.user.id,user.id)
 assert.equal((await api('profile',{username:user.username})).username,user.username)
 const existing=query(`SELECT id,puzzle_id,score FROM results WHERE user_id=${quote(user.id)} ORDER BY seq DESC LIMIT 1`)[0]
 if(existing) assert.equal((await api('results',{id:existing.id,puzzleId:existing.puzzle_id,score:existing.score})).duplicate,true)
 const refresh=await api('profile');assert.deepEqual(refresh.history,profile.history)
 assert.ok(board.entries.every((p,i,all)=>!i||all[i-1].rating>=p.rating))
 console.log(`${preview?'Preview':'Production'} API smoke passed: model ${profile.ratingModelId}, baseline 1000, ${profile.games} runs, complete graph, duplicate retry, username, account renewal, refresh and leaderboard.`)
} finally {
 query(`DELETE FROM sessions WHERE token_hash=${quote(digest)}`)
}
