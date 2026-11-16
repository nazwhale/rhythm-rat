import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseLevel } from '../src/level.ts'
import { puzzleContent } from '../src/ratings/catalog.ts'
const dir = new URL('../src/levels/', import.meta.url)
const catalog = await Promise.all((await readdir(dir)).filter(n => n.endsWith('.json')).sort().map(async name => {
  const level = parseLevel(JSON.parse(await readFile(new URL(name, dir), 'utf8')))
  return { id: createHash('sha256').update(puzzleContent(level)).digest('hex'), levelId: level.id, title: level.title, authoredSeed: level.rating, seed: level.rating + 500 }
}))
const quote = s => "'" + s.replaceAll("'", "''") + "'"
await writeFile(new URL('../worker/catalog.json', import.meta.url), JSON.stringify(catalog))
await writeFile(new URL('../.catalog.sql', import.meta.url), catalog.map(p => `INSERT INTO puzzles(id,level_id,authored_seed) VALUES (${quote(p.id)},${quote(p.levelId)},${p.authoredSeed}) ON CONFLICT(id) DO UPDATE SET authored_seed=COALESCE(puzzles.authored_seed,excluded.authored_seed);`).join('\n'))
console.log(`Prepared ${catalog.length} puzzle versions.`)
