import { memo, useEffect, useRef, type KeyboardEvent } from 'react'

import type { GamePhase } from './runState'
export default memo(function TapZone({ phase, cleared, hasHolds, resetKey, onPress, onRelease, onCancel }: {
  phase: GamePhase; cleared: boolean; hasHolds: boolean; resetKey: string
  onPress: () => void; onRelease: () => void; onCancel: () => void
}) {
  const pointer = useRef<number | null>(null)
  useEffect(() => { pointer.current = null }, [resetKey])
  const title = phase === 'finished' ? 'Next level' : phase === 'ready' ? 'Tap to start' : cleared ? 'All notes eaten!' : phase === 'countin' ? 'Listen to the count-in' : 'Tap here to eat'
  const hint = phase === 'finished' ? 'Tap or press Space to continue' : cleared ? 'Heading for the mouse hole…' : hasHolds ? 'Hold for ties · release at the last tied note' : 'One tap per note · Space works too'
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return
    event.preventDefault()
    if (down) { if (!event.repeat) onPress() } else onRelease()
  }
  return <button type="button" className={`tap-zone ${cleared ? 'is-cleared' : ''}`} disabled={phase === 'lost'}
    onPointerDown={(event) => {
      if (event.button !== 0 || pointer.current !== null) return
      event.preventDefault(); pointer.current = event.pointerId
      // Capture keeps a tied hold alive when the finger drifts outside the pad.
      event.currentTarget.setPointerCapture(event.pointerId); onPress()
    }}
    onPointerUp={(event) => { if (pointer.current === event.pointerId) { pointer.current = null; onRelease() } }}
    onPointerCancel={(event) => { if (pointer.current === event.pointerId) { pointer.current = null; onCancel() } }}
    onLostPointerCapture={(event) => { if (pointer.current === event.pointerId) { pointer.current = null; onCancel() } }}
    onKeyDown={(event) => handleKey(event, true)} onKeyUp={(event) => handleKey(event, false)} onBlur={onCancel}
    onClick={(event) => {
      // Pointer input is judged on down, not on the delayed synthetic click.
      // Zero-detail activation still supports assistive technologies.
      if (event.detail === 0) { onPress(); onRelease() }
    }}>
    <strong>{title}</strong><span>{hint}</span>
  </button>
})
