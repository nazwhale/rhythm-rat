import assert from 'node:assert/strict'
import { GROOVE_LAYERS, patternOptions, chooseGroove, unlockedLayerCount, pickRandom, hitsAtStep } from '../src/groove.ts'
import { LEAD_INSTRUMENTS, CHORD_INSTRUMENTS, BASS_INSTRUMENTS, chooseBassInstrument, TIMEKEEPER_INSTRUMENTS, chooseTimekeeperInstrument, chooseLeadInstrument, chooseChordInstrument, chooseMusicInstruments } from '../src/musicInstruments.ts'

for (const { id, entryBar } of GROOVE_LAYERS) {
  const options = patternOptions(id)
  assert.equal(options.length, ['hats', 'pad'].includes(id) ? 19 : 15, `${id} part count`)
  assert.equal(new Set(options.map(({ name }) => name)).size, options.length)
  for (let index = 0; index < options.length; index++) {
    const pattern = chooseGroove(() => (index + .5) / options.length)[id]
    assert.equal(pattern.name, options[index].name)
    const length = pattern.lengthSteps ?? 16
    assert([16, 32, 64].includes(length))
    assert(pattern.hits.length > 0)
    assert.equal(new Set(pattern.hits.map(({ step }) => step)).size, pattern.hits.length)
    pattern.hits.forEach((hit, index) => {
      assert(Number.isInteger(hit.step) && hit.step >= 0 && hit.step < length)
      assert(hit.velocity > 0 && hit.velocity <= 1)
      if (['bass', 'synth', 'pad'].includes(id)) {
        assert(pattern.voice)
        assert(hit.notes.length > 0)
        assert(hit.durationSteps > 0)
        assert(hit.step + hit.durationSteps <= (pattern.hits[index + 1]?.step ?? length))
      }
      assert(hitsAtStep(pattern, hit.step).includes(hit))
      assert(hitsAtStep(pattern, hit.step + length).includes(hit))
    })
    // Scheduler must visit every hit once, including the second/fourth bar.
    assert.equal(Array.from({ length }, (_, step) => hitsAtStep(pattern, step).length).reduce((a, b) => a + b), pattern.hits.length)
  }
  assert.equal(unlockedLayerCount(entryBar - 1), GROOVE_LAYERS.findIndex((layer) => layer.id === id) + 1)
}
assert.equal(unlockedLayerCount(0), 0)
assert.equal(unlockedLayerCount(8), 6)
assert.throws(() => pickRandom([], Math.random))
for (let layerIndex = 0; layerIndex < GROOVE_LAYERS.length; layerIndex++) {
  const count = patternOptions(GROOVE_LAYERS[layerIndex].id).length
  for (let option = 0; option < count; option++) {
    let calls = 0
    const selection = chooseGroove(() => { const index = calls++; return (index === layerIndex ? option + .5 : .5) / patternOptions(GROOVE_LAYERS[index].id).length })
    GROOVE_LAYERS.forEach(({ id }, index) => {
      assert.equal(selection[id].name, patternOptions(id)[index === layerIndex ? option : 0].name)
    })
  }
}
for (const [options, choose] of [[LEAD_INSTRUMENTS, chooseLeadInstrument], [CHORD_INSTRUMENTS, chooseChordInstrument], [BASS_INSTRUMENTS, chooseBassInstrument], [TIMEKEEPER_INSTRUMENTS, chooseTimekeeperInstrument]]) {
  options.forEach((instrument, index) => assert.equal(choose(() => (index + .5) / options.length), instrument))
}
for (let lead = 0; lead < 4; lead++) for (let chords = 0; chords < 3; chords++) for (let bass = 0; bass < 3; bass++) for (let timekeeper = 0; timekeeper < 2; timekeeper++) {
  let call = 0
  const values = [(lead + .5) / 4, (chords + .5) / 3, (bass + .5) / 3, (timekeeper + .5) / 2]
  const selection = chooseMusicInstruments(() => values[call++])
  assert.equal(selection.lead, LEAD_INSTRUMENTS[lead])
  assert.equal(selection.chords, CHORD_INSTRUMENTS[chords])
  assert.equal(selection.bass, BASS_INSTRUMENTS[bass])
  assert.equal(selection.timekeeper, TIMEKEEPER_INSTRUMENTS[timekeeper])
}
const backbeat = patternOptions('pad').find(({ name }) => name === 'Two and four')
assert.deepEqual(backbeat.hits.map(({ step }) => step), [4, 12])
assert(patternOptions('hats').some(({ hits }) => hits.some(({ articulation }) => articulation === 'open')))
assert(patternOptions('snare').some(({ hits }) => hits.some(({ articulation }) => articulation === 'rim')))
console.log('Verified expanded pattern catalogs, multi-bar timing and rests, independent choices, 72 instrument combinations, chord backbeat, open hats and rim clicks.')
