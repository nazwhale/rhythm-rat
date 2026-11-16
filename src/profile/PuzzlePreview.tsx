import { lazy, Suspense, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Level } from '../level'
const Score=lazy(()=>import('./PuzzleScorePreview'))
export type Preview = { level:Level; top:number; left:number; pinned:boolean }
export default function PuzzlePreview({ preview, onClose, id }: { preview:Preview; onClose:()=>void; id:string }) {
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    if(preview.pinned)dialog.current?.showModal()
  },[preview.pinned])
  const close=()=>{dialog.current?.close();onClose()}
  const content=<><div className="score-preview-heading"><div><h2>{preview.level.title}</h2><p>8 bars · {preview.level.beatsPerBar}/4 · {preview.level.bpm} BPM{!preview.pinned&&' · Click to enlarge'}</p></div>{preview.pinned&&<button autoFocus type="button" className="text-button" onClick={close}>Close</button>}</div><Suspense fallback={<p role="status">Loading score…</p>}><Score level={preview.level}/></Suspense></>
  return createPortal(preview.pinned
    ? <dialog ref={dialog} className="score-preview score-preview-dialog" aria-label={`${preview.level.title} score`} onCancel={event=>{event.preventDefault();close()}}>{content}</dialog>
    : <div id={id} className="score-preview score-preview-tooltip" role="tooltip" style={{top:preview.top,left:preview.left}}>{content}</div>,document.body)
}
