import { memo, useMemo } from 'react'
import type { Level } from '../level'
import { getLevelNoteTypes } from './levelPreview'
import NoteTypeIcon from './NoteTypeIcon'

export default memo(function CountInPreview({ level, countdown }: { level: Level; countdown: number }) {
  const noteTypes = useMemo(() => getLevelNoteTypes(level), [level])
  return <section className="count-in-preview" aria-label="Count-in and note types in this level">
    <div className="count-in-beat"><strong aria-live="off">{countdown || 'GO!'}</strong><span>COUNT IN</span></div>
    <div className="count-in-guide"><span className="count-in-heading">IN THIS LEVEL</span><ul>{noteTypes.map((type) => <li key={type.id}>
      <NoteTypeIcon {...type} /><span><strong>{type.label}</strong><small>{type.detail}</small></span>
    </li>)}</ul></div>
  </section>
})
