import assert from 'node:assert/strict'
import { sceneryForLevel, sceneryScroll, SCENERY_PERIOD } from '../src/scenery.ts'

for (const count of [1, 2, 3, 14, 24, 30]) {
  let previous = null
  const profiles = Array.from({ length: count }, (_, index) => sceneryForLevel(index, count))
  for (const profile of profiles) {
    assert.ok(profile.skyline.urbanity >= profile.street.urbanity, 'The horizon develops before the street')
    for (const layer of ['skyline', 'street']) {
      assert.ok(profile[layer].urbanity >= 0 && profile[layer].urbanity <= 1)
      if (previous) {
        assert.ok(profile[layer].urbanity > previous[layer].urbanity, 'Every level advances each layer')
        assert.ok(profile[layer].density >= previous[layer].density)
        assert.notEqual(profile[layer].offset, previous[layer].offset)
        assert.notEqual(profile[layer].variant, previous[layer].variant)
      }
    }
    previous = profile
  }
  assert.equal(new Set(profiles.map(JSON.stringify)).size, count)
  assert.equal(profiles[0].skyline.urbanity, 0)
  if (count > 1) assert.equal(profiles.at(-1).street.urbanity, 1)
}
assert.deepEqual(sceneryForLevel(-1, 24), sceneryForLevel(0, 24))
assert.deepEqual(sceneryForLevel(24, 24), sceneryForLevel(23, 24))
assert.deepEqual(sceneryForLevel(0, 0), sceneryForLevel(0, 1))
assert.ok(Array.from({ length: 24 }, (_, i) => sceneryForLevel(i, 24)).some(({ skyline, street }) => skyline.settlement !== street.settlement), 'Layers change settlement types at different levels')
for (const speed of [.13, .38]) {
  for (const distance of [0, 50, 5000, 10000]) {
    const position = sceneryScroll(distance, speed, 137)
    assert.ok(position <= 0 && position > -SCENERY_PERIOD)
    assert.ok(Math.abs(position - sceneryScroll(distance + SCENERY_PERIOD / speed, speed, 137)) < 1e-8)
  }
}
console.log('Verified per-level profiles, independent layer progression/offsets, monotonic density and seamless scroll periods.')
