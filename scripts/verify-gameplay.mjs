import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { getLevelNoteTypes } from '../src/gameplay/levelPreview.ts'
import { hasCompletedAllNotes } from '../src/gameplay/runState.ts'
import { noteSpec } from '../src/level.ts'

const directory = new URL('../src/levels/', import.meta.url)
const levels = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(new URL(name, directory), 'utf8'))))
for (const level of levels) {
  const types = getLevelNoteTypes(level)
  const expected = new Set()
  for (const token of level.bars.flat()) {
    const note = noteSpec(token)
    expected.add(`${note.rest ? 'rest-' : ''}${note.duration}${note.dotted ? '-dotted' : ''}`)
    if (note.tie) expected.add('tie')
  }
  assert.deepEqual(new Set(types.map(type => type.id)), expected)
  assert.ok(types.every(type => type.label && type.detail))
}
assert.deepEqual(getLevelNoteTypes(levels.find(level => level.id === 'tiny-nibbles')).map(type => type.id), ['h'])
assert.deepEqual(new Set(getLevelNoteTypes(levels.find(level => level.id === 'the-first-lap')).map(type => type.id)), new Set(['q', '8']))
const difficult = getLevelNoteTypes(levels.find(level => level.id === 'midnight-munch'))
assert.ok(difficult.some(type => type.id === 'tie'))
assert.ok(difficult.some(type => type.id === 'q-dotted'))
assert.ok(difficult.some(type => type.rest))
const success = { perfect: 12, good: 4, miss: 0, extra: 0 }
assert.equal(hasCompletedAllNotes(success, 16, false), true)
assert.equal(hasCompletedAllNotes(success, 16, true), false, 'A held final tie must still be released successfully')
assert.equal(hasCompletedAllNotes({ ...success, good: 3 }, 16, false), false)
assert.equal(hasCompletedAllNotes({ ...success, miss: 1 }, 16, false), false)
assert.equal(hasCompletedAllNotes({ ...success, extra: 1 }, 16, false), false)
assert.equal(hasCompletedAllNotes({ perfect: 0, good: 0, miss: 0, extra: 0 }, 0, false), false)
console.log('Verified exact note-type previews for every level, dots/rests/ties, and completion only after all successful taps and hold releases.')
