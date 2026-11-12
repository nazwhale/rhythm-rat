import assert from 'node:assert/strict'
import { MUSIC_STYLES, chooseStyleArrangement, stylePatternOptions } from '../src/musicStyles.ts'
import { GROOVE_LAYERS } from '../src/groove.ts'
import { createGrooveClock } from '../src/grooveClock.ts'

for (const [index, style] of MUSIC_STYLES.entries()) {
  for (const { id } of GROOVE_LAYERS) {
    const options = stylePatternOptions(style, id)
    assert(options.length >= 3, `${style.id}/${id} offers variation`)
  }
  for (const fraction of [0, .2, .49, .75, .9999]) {
    let calls = 0
    const choice = chooseStyleArrangement(() => calls++ === 0 ? (index + .5) / MUSIC_STYLES.length : fraction)
    assert.equal(choice.style, style)
    GROOVE_LAYERS.forEach(({ id }) => assert(style.parts[id].includes(choice.patterns[id].name)))
    Object.entries(choice.instruments).forEach(([role, instrument]) => assert(style.instruments[role].includes(instrument.id)))
  }
}
const events = []
const clock = createGrooveClock((step, time, duration, layers) => events.push({ step, time, duration, layers }))
clock.configure(1, .5, 6)
for (let time = .95; time < 25; time += .02) clock.pump(time)
assert(events.some(({ step }) => step > 128), 'music continues past an eight-bar level')
assert.equal(new Set(events.map(({ step }) => step)).size, events.length, 'no duplicate steps')
assert(events.every(({ layers }) => layers === 6))
const count = events.length
clock.pump(100)
assert(events.length - count <= 1, 'background pauses do not replay stale notes')
console.log('Verified all style pools, random instrument compatibility, continuous playback beyond level end, and no duplicate or stale bursts.')
