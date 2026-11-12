import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

// Transpile the scene module without mounting React; exercise the actual registry
// and selector, including boundary seeds and reachability of every surprise.
const source = await readFile(new URL('../src/discoSurprises.tsx', import.meta.url), 'utf8')
const { code } = await transformWithOxc(source, 'discoSurprises.tsx', { jsx: { runtime: 'classic' } })
const { DISCO_SURPRISES, chooseDiscoSurprises } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
assert.equal(DISCO_SURPRISES.length, 20)
assert.equal(new Set(DISCO_SURPRISES.map(s => s.id)).size, 20)
for (const surprise of DISCO_SURPRISES) {
  assert.ok(surprise.description.length > 0)
  assert.equal(typeof surprise.Scene, 'function')
}
const reached = new Set()
for (const seed of [0, 1, -1, 0xffffffff, ...Array.from({ length: 20000 }, (_, i) => i)]) {
  const selected = chooseDiscoSurprises(seed)
  assert.equal(selected.length, 2)
  assert.notEqual(selected[0].id, selected[1].id)
  assert.deepEqual(chooseDiscoSurprises(seed), selected)
  for (const surprise of selected) {
    assert.ok(DISCO_SURPRISES.includes(surprise))
    reached.add(surprise.id)
  }
}
assert.equal(reached.size, 20)
console.log('Verified twenty unique scenes; two distinct scenes per completion; stable seeded selection; boundary seeds; and reachability of every surprise.')
