// Administrator-only: uses Wrangler's Cloudflare credentials, never a public API.
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createModel, replayPage, activate, pause, resumeModel, validateModel } from '../worker/rebuild.ts'
import { DEFAULT_SETTINGS } from '../worker/ratingModel.ts'

const args=process.argv.slice(2), command=args[0], environment=args.includes('--preview')?'preview':''
const remote=!args.includes('--local')
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]}
const sqlValue=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'"
function query(sql) {
  const output=execFileSync('npx',['wrangler','d1','execute','DB',remote?'--remote':'--local','--env',environment,'--command',sql,'--json'],{encoding:'utf8',maxBuffer:32*1024*1024})
  const data=JSON.parse(output)
  if (data.some(r=>r.success===false)) throw new Error('Database batch failed')
  return data
}
const statement=sql=>({sql,bind(...values){let i=0;return statement(sql.replaceAll('?',()=>sqlValue(values[i++])));},async first(){return query(sql)[0].results[0]??null},async all(){return query(sql)[0]},async run(){return query(sql)[0]}})
const db={prepare:statement,async batch(statements){return query(statements.map(s=>s.sql).join(';'))}}
const id=option('--id')
if (command==='init') {
  const catalog=JSON.parse(await readFile(new URL('../worker/catalog.json',import.meta.url)))
  const columns=await db.prepare('PRAGMA table_info(puzzles)').all()
  const legacy=columns.results.some(c=>c.name==='rating')
  const writes=catalog.map(p=>db.prepare(legacy?'INSERT INTO puzzles(id,level_id,rating,authored_seed) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET authored_seed=COALESCE(puzzles.authored_seed,excluded.authored_seed)':'INSERT INTO puzzles(id,level_id,authored_seed) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(...(legacy?[p.id,p.levelId,p.seed,p.authoredSeed]:[p.id,p.levelId,p.authoredSeed])))
  await db.batch(writes)
  const missing=await db.prepare('SELECT COUNT(*) n FROM puzzles WHERE authored_seed IS NULL').first()
  if (missing.n) throw new Error('Archived puzzles need their original authored seeds before replay')
  console.log('Immutable puzzle seeds initialized.')
} else if (command==='pause') {
  await pause(db);console.log('Rated writes paused; client outbox retains results.')
} else if (command==='create') {
  if (!id) throw new Error('--id required')
  const settings=option('--settings')?JSON.parse(await readFile(option('--settings'),'utf8')):{...DEFAULT_SETTINGS,initialRating:Number(option('--initial')??1000)}
  await createModel(db,id,settings);console.log('Candidate created; rated writes paused.')
} else if (command==='rebuild' || command==='rollback') {
  if (!id) throw new Error('--id required')
  await resumeModel(db,id)
  const maxPages=Number(option('--pages')??Infinity)
  let pages=0
  while(pages<maxPages && await replayPage(db,id,25)) {pages++;console.log(`Checkpoint ${pages} committed.`)}
  console.log('Replay checkpointed. Run validate then activate when complete.')
} else if (command==='validate') {
  if (!id) throw new Error('--id required')
  await validateModel(db,id)
  if (args.includes('--legacy')) {
    const model=await db.prepare('SELECT settings FROM rating_models WHERE id=?').bind(id).first()
    const policy=JSON.parse(model.settings)
    const diffs=await db.prepare(`SELECT COUNT(*) n FROM (SELECT u.rating a,u.rd b,u.volatility c,COALESCE(s.rating,${policy.initialRating}) x,COALESCE(s.rd,${policy.playerRd}) y,COALESCE(s.volatility,${policy.volatility}) z FROM users u LEFT JOIN rating_state s ON s.user_id=u.id AND s.model_id=${sqlValue(id)} UNION ALL SELECT p.rating,p.rd,p.volatility,COALESCE(s.rating,p.authored_seed+${policy.puzzleOffset}),COALESCE(s.rd,${policy.puzzleRd}),COALESCE(s.volatility,${policy.volatility}) FROM puzzles p LEFT JOIN rating_state s ON s.puzzle_id=p.id AND s.model_id=${sqlValue(id)}) WHERE x IS NULL OR a<>x OR b<>y OR c<>z`).first()
    if(diffs.n)throw new Error(`Legacy replay mismatch: ${diffs.n} subjects`)
    console.log('Legacy replay exactly matches all users and puzzles.')
  }
  console.log('Model complete; graph endpoints and participants validated.')
} else if (command==='activate') {
  if (!id) throw new Error('--id required')
  await activate(db,id);console.log('Model activated; rated writes resumed.')
} else if (command==='status') {
  console.log(JSON.stringify((await db.prepare('SELECT id,settings,active,paused,status,watermark FROM rating_models ORDER BY created_at').all()).results,null,2))
} else if (command==='cleanup') {
  const active=await db.prepare('SELECT id FROM rating_models WHERE active=1 AND paused=0').first()
  if(!active)throw new Error('Activate and validate the replacement first')
  await validateModel(db,active.id)
  const sql=await readFile(new URL('../scripts/ratings-cleanup.sql',import.meta.url),'utf8')
  query(sql);console.log('Obsolete rating columns removed.')
} else {
  throw new Error('Usage: npm run ratings:admin -- init|pause|create|rebuild|validate|activate|rollback|status|cleanup [--id MODEL] [--initial 1000] [--preview|--local] [--pages N] [--legacy]')
}
