import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { parseLevel, createEvents, createOnsets, levelSeconds, nextChallenge } from '../src/level.ts'

import { judgeTap, judgeRelease } from '../src/timing.ts'

const directory = new URL('../src/levels/', import.meta.url)
const levels = await Promise.all((await readdir(directory)).filter((name) => name.endsWith('.json')).map(async (name) => parseLevel(JSON.parse(await readFile(new URL(name, directory), 'utf8')))))
assert.equal(new Set(levels.map((level) => level.id)).size, levels.length)
for (const level of levels) {
  const onsets = createOnsets(level)
  assert.equal(onsets[0].seconds, 0)
  assert.equal(levelSeconds(level), 32 * 60 / level.bpm)
  onsets.forEach((onset, index) => {
    assert.equal(onset.index, index)
    assert.ok(onset.seconds < levelSeconds(level))
    if (index) assert.ok(onset.seconds > onsets[index - 1].seconds)
  })
  const events = createEvents(level)
  for (let bar = 0; bar < 8; bar++) assert.equal(events.find((note) => note.bar === bar).seconds, bar * 4 * 60 / level.bpm)
  assert.equal(onsets.length, events.filter((note, index) => !note.rest && !events[index - 1]?.tie).length)
  events.forEach((event, index) => {
    if (event.rest) assert.equal(event.attackIndex, null)
    if (event.tie) assert.equal(event.attackIndex, events[index + 1].attackIndex)
  })
}
const easy = levels.find((level) => level.id === 'steady-bites')
assert.equal(createOnsets(easy).length, 32)
assert.ok(createOnsets(easy).every((note) => note.duration === 'q'))
const mixed = levels.find((level) => level.id === 'the-first-lap')
assert.ok(createOnsets(mixed).some((note) => note.duration === '8'))
assert.ok(easy.rating < mixed.rating)
assert.throws(() => parseLevel({ ...easy, bars: easy.bars.slice(1) }))
assert.throws(() => parseLevel({ ...easy, bars: [['q'], ...easy.bars.slice(1)] }))
assert.throws(() => parseLevel({ ...easy, bars: [['x', 'q', 'q', 'q'], ...easy.bars.slice(1)] }))
assert.throws(() => parseLevel({ ...easy, bpm: 0 }))
const initial = { levelIndex: 0, attempt: 1 }
const retry = nextChallenge(initial, false, levels.length)
assert.deepEqual(retry, { levelIndex: 0, attempt: 2 })
assert.deepEqual(nextChallenge(retry, false, levels.length), initial)
assert.deepEqual(nextChallenge(initial, true, levels.length), { levelIndex: 1, attempt: 1 })
assert.deepEqual(nextChallenge(retry, true, levels.length), { levelIndex: 1, attempt: 1 })
for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
  assert.deepEqual(nextChallenge({ levelIndex, attempt: 1 }, false, levels.length), { levelIndex, attempt: 2 })
  assert.deepEqual(nextChallenge({ levelIndex, attempt: 2 }, false, levels.length), { levelIndex: Math.max(0, levelIndex - 1), attempt: 1 })
  for (const attempt of [1, 2]) {
    assert.deepEqual(nextChallenge({ levelIndex, attempt }, true, levels.length), { levelIndex: (levelIndex + 1) % levels.length, attempt: 1 })
  }
}
assert.deepEqual(nextChallenge({ levelIndex: 0, attempt: 2 }, false, 1), initial)
assert.deepEqual(nextChallenge(initial, true, 1), initial)
console.log(`Verified ${levels.length} level files, onset timing, validation and two-attempt progression.`)

// Off-beat and repeated presses must fail, including after the final note.
assert.equal(judgeTap(0.25, 0.55, false), 'extra')
assert.equal(judgeTap(0.8, 0.55, false), 'extra')
assert.equal(judgeTap(0.01, 0.55, false), 'extra')
assert.equal(judgeTap(17, undefined, false), 'extra')
assert.equal(judgeTap(0, 0, false), 'perfect')
assert.equal(judgeTap(0.09, 0, false), 'late')
assert.equal(judgeTap(-0.09, 0, true), 'early')
assert.equal(judgeTap(-1, 0, true), 'ignore')
assert.equal(judgeTap(0.121, 0, false), 'extra')
console.log('Verified off-beat, duplicate and post-final taps, hit tolerance and count-in protection.')

assert.ok(levels.length >= 4)
for (const id of ['rest-and-relish', 'midnight-munch']) {
  const level = levels.find((item) => item.id === id)
  assert.ok(level)
  const events = createEvents(level)
  const onsets = createOnsets(level)
  assert.ok(events.some((note) => note.rest))
  assert.ok(onsets.some((note) => note.holdSeconds > 0))
  assert.ok(events.some((event, index) => event.tie && event.bar !== events[index + 1].bar))
  assert.ok(events.some((event, index) => event.tie && event.bar === events[index + 1].bar))
  for (const onset of onsets.filter((note) => note.holdSeconds > 0)) {
    assert.equal(judgeRelease(onset.endSeconds, onset.endSeconds), 'complete')
    assert.equal(judgeRelease(onset.endSeconds - 0.2, onset.endSeconds), 'early')
    assert.equal(judgeRelease(onset.endSeconds + 0.2, onset.endSeconds), 'late')
    assert.equal(judgeRelease(onset.endSeconds - 0.09, onset.endSeconds), 'complete')
  }
}
const restLevel = levels.find((level) => level.id === 'rest-and-relish')
const rest = createEvents(restLevel).find((event) => event.rest && event.duration === 'q')
const next = createOnsets(restLevel).find((note) => note.seconds > rest.seconds)
assert.equal(judgeTap(rest.seconds + 0.2, next.seconds, false), 'extra')
const tied = createOnsets(restLevel).find((note) => note.holdSeconds > 0)
assert.ok(Math.abs(tied.holdSeconds - 0.5 * 60 / 110) < 1e-10)
assert.throws(() => parseLevel({ ...easy, bars: [...easy.bars.slice(0, 7), ['q', 'q', 'q', { duration: 'q', tie: true }]] }))
assert.throws(() => parseLevel({ ...easy, bars: [[{ duration: 'q', tie: true }, { duration: 'q', rest: true }, 'q', 'q'], ...easy.bars.slice(1)] }))
assert.throws(() => parseLevel({ ...easy, bars: [[null], ...easy.bars.slice(1)] }))
console.log('Verified rests, dotted durations, half notes, tie chains, cross-bar holds and release windows.')

// Preserve every distinct written rhythm from the reference, including incoming ties.
function signature(bar) {
  return bar.map((token) => {
    if (typeof token === 'string') return token
    return `${token.rest ? 'r' : ''}${token.duration}${token.dotted ? '.' : ''}${token.tie ? '~' : ''}`
  }).join(' ')
}
assert.deepEqual(restLevel.bars.map(signature), [
  '8 8 q rq 8 8~', '8 8 r8 8~ 8 8 q', '8 8 q q 8 8~', '8 8 r8 8~ 8 q.',
  '8 8 q q r8 8~', '8 q 8~ 8 8 q', '8 8 q q r8 8~', 'q q 8 8 q',
])
assert.deepEqual(levels.find((level) => level.id === 'midnight-munch').bars.map(signature), [
  '8 8 q q r8 8~', 'q 8 8~ 8 q.', 'q q 8 8 q', 'q q q 8 8~',
  '8 8 8 8~ q. 8~', 'q 8 8~ q 8 8~', '8 8 8 8~ q. 8~', 'q 8 8~ h',
])
console.log('Verified source-bar rhythm coverage across both new levels.')

for (const level of levels) {
  const events = createEvents(level)
  const onsets = createOnsets(level)
  for (const hold of onsets.filter((note) => note.holdSeconds > 0)) {
    const chain = events.filter((note) => note.attackIndex === hold.index)
    const target = chain.at(-1)
    assert.equal(hold.endSeconds, target.seconds)
    assert.ok(!onsets.some((note) => note.seconds === target.seconds), 'The tie target must not require another press')
    const following = onsets[hold.index + 1]
    if (following) {
      assert.ok(hold.endSeconds < following.seconds, 'The hold must end before the next separate note')
      assert.equal(judgeRelease(following.seconds, hold.endSeconds), 'late')
      assert.equal(judgeTap(following.seconds, following.seconds, false), 'perfect')
    }
  }
}
console.log('Verified holds stop at the final tie target and following notes remain separate presses.')

const bridgeIds = ['pause-for-cheese', 'offbeat-nibbles', 'a-little-stretch', 'across-the-cracks']
const bridge = bridgeIds.map((id) => {
  const level = levels.find((item) => item.id === id)
  assert.ok(level, `Missing stepping-stone level: ${id}`)
  assert.ok(level.rating > mixed.rating && level.rating < restLevel.rating)
  return level
})
assert.deepEqual([...bridge].sort((a, b) => a.rating - b.rating).map((level) => level.id), bridgeIds)
const pauseEvents = createEvents(bridge[0])
assert.ok(pauseEvents.some((note) => note.rest && note.duration === 'q'))
assert.ok(pauseEvents.every((note) => !note.tie && !(note.rest && note.duration === '8')))
const offbeatEvents = createEvents(bridge[1])
assert.ok(offbeatEvents.some((note) => note.rest && note.duration === '8'))
assert.ok(offbeatEvents.every((note) => !note.tie))
const firstHolds = createOnsets(bridge[2]).filter((note) => note.holdSeconds > 0)
assert.equal(firstHolds.length, 1, 'The first hold level must introduce exactly one hold')
assert.equal(firstHolds[0].bar, 3, 'Give three familiar bars before the first hold')
const stretchEvents = createEvents(bridge[2])
assert.ok(stretchEvents.filter((note) => note.attackIndex === firstHolds[0].index).every((note) => note.bar === 3))
const crossEvents = createEvents(bridge[3])
assert.equal(createOnsets(bridge[3]).filter((note) => note.holdSeconds > 0).length, 3)
assert.equal(crossEvents.filter((note, index) => note.tie && note.bar !== crossEvents[index + 1].bar).length, 1)
for (const level of bridge) {
  assert.ok(new Set(level.bars.map(signature)).size < 8, 'Introductory levels should repeat familiar patterns')
  assert.ok(createEvents(level).every((note) => !note.dotted && note.duration !== 'h'), 'Save dotted notes and minims for later levels')
}
console.log('Verified four ordered stepping-stone levels, gradual rest/hold introduction, and exactly one hold in the first hold level.')

assert.equal(judgeTap(0.034, 0, false), 'perfect')
assert.equal(judgeTap(0.05, 0, false), 'good')
assert.equal(judgeTap(-0.07, 0, false), 'good')
assert.equal(judgeTap(-0.10, 0, false), 'early')
assert.equal(judgeTap(0.10, 0, false), 'late')
assert.equal(judgeTap(0.13, 0, false), 'extra')
console.log('Verified four timing feedback bands within the unchanged failure window.')

// These six additions precede the original third level, Pause for Cheese.
const beginnerIds = ['tiny-nibbles', 'little-paws', 'cheese-at-dusk', 'double-helping', 'middle-munch', 'around-the-block']
const beginners = beginnerIds.map((id) => levels.find((level) => level.id === id))
assert.ok(beginners.every(Boolean), 'All six beginner levels must be present')
assert.deepEqual([...beginners].sort((a, b) => a.rating - b.rating).map((level) => level.id), beginnerIds)
assert.equal(new Set(beginners.map((level) => JSON.stringify(level.bars))).size, 6, 'Beginner levels must have distinct patterns')
for (const level of beginners) {
  assert.ok(level.rating < mixed.rating)
  assert.ok(level.rating < bridge[0].rating)
  const events = createEvents(level)
  assert.ok(events.every((note) => !note.rest && !note.tie && !note.dotted && ['h', 'q', '8'].includes(note.duration)))
  assert.ok(createOnsets(level).length < createOnsets(mixed).length, 'Use fewer attacks than The First Lap')
  assert.ok(events.some((note) => note.duration === 'h'), 'Include half notes for slower, spaced taps')
  assert.ok(level.bars.filter((bar) => !bar.includes('8')).length >= 4, 'Include at least four bars without eighth notes')
  for (const bar of level.bars) {
    assert.ok(bar.filter((token) => token === '8').length <= 2, 'At most one eighth-note pair per bar')
  }
}
console.log('Verified six distinct beginner levels with half notes, simple paired eighths and recovery bars before the original level 3.')
