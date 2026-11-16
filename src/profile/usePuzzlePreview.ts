import { useEffect, useId, useState, type ComponentProps } from 'react'
import { LEVELS } from '../levels'
import type { Preview } from './PuzzlePreview'

const levelsById = new Map(LEVELS.map(level => [level.id, level]))

function position(rect: DOMRect) {
  const width = Math.min(940, window.innerWidth - 24)
  const height = width >= 760 ? 340 : width >= 400 ? 570 : 1000
  return {
    top: rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - height - 8),
    left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
  }
}

export function usePuzzlePreview() {
  const [preview, setPreview] = useState<(Preview & { rowId: string; button: HTMLButtonElement }) | null>(null)
  const previewId = useId()
  const close = () => setPreview(null)

  useEffect(() => {
    const updatePosition = () => setPreview(current => {
      if (!current || current.pinned) return current
      if (document.activeElement !== current.button || !current.button.matches(':focus-visible')) return null
      const rect = current.button.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return null
      return { ...current, ...position(rect) }
    })
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [])

  function triggerProps(rowId: string, levelId: string | undefined): ComponentProps<'button'> | null {
    const level = levelId ? levelsById.get(levelId) : undefined
    if (!level) return null

    const show = (button: HTMLButtonElement, pinned = false) => {
      const next = { level, rowId, button, pinned, ...position(button.getBoundingClientRect()) }
      setPreview(current => current?.pinned && !pinned ? current : next)
    }

    const dismiss = () => setPreview(current => current?.rowId === rowId && !current.pinned ? null : current)
    return {
      type: 'button',
      className: 'puzzle-preview-trigger',
      'aria-label': `Preview ${level.title}`,
      'aria-describedby': preview?.rowId === rowId && !preview.pinned ? previewId : undefined,
      onPointerEnter: event => { if (event.pointerType === 'mouse') show(event.currentTarget) },
      onPointerLeave: dismiss,
      onFocus: event => show(event.currentTarget),
      onBlur: dismiss,
      onClick: event => show(event.currentTarget, true),
      onKeyDown: event => {
        if (event.key === 'Escape' && preview?.rowId === rowId) {
          event.preventDefault()
          close()
        }
      },
    }
  }

  return { preview, previewId, close, triggerProps }
}
