import assert from 'node:assert/strict'
import { settlementForLevel } from '../src/scenery.ts'

assert.deepEqual(Array.from({ length: 24 }, (_, index) => settlementForLevel(index, 24)), [
  ...Array(8).fill('village'), ...Array(8).fill('town'), ...Array(8).fill('city'),
])
// The journey adapts to added levels and handles short lists and boundaries.
for (const count of [1, 2, 3, 8, 14, 24, 25, 30]) {
  const settlements = Array.from({ length: count }, (_, index) => settlementForLevel(index, count))
  assert.equal(settlements[0], 'village')
  if (count >= 3) assert.equal(settlements.at(-1), 'city')
  const ranks = settlements.map((place) => ['village', 'town', 'city'].indexOf(place))
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b))
  assert.equal(settlementForLevel(-1, count), 'village')
  assert.equal(settlementForLevel(count, count), settlements.at(-1))
}
assert.equal(settlementForLevel(0, 0), 'village')
assert.equal(settlementForLevel(8, 24), 'town')
assert.equal(settlementForLevel(7, 24), 'village', 'Returning to an easier level returns to its scenery')
assert.equal(settlementForLevel(16, 24), 'city')
assert.equal(settlementForLevel(15, 24), 'town')
console.log('Verified village/town/city thirds, expansion to new level counts, backward transitions and list boundaries.')
