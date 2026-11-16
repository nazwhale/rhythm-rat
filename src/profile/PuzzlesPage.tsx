import { useEffect, useState } from 'react'
import PuzzlePreview from './PuzzlePreview'
import { usePuzzlePreview } from './usePuzzlePreview'
import { api } from '../ratings/api'
import type { PuzzleCatalog } from '../ratings/onlineTypes'
export default function PuzzlesPage() {
  const { preview, previewId, close, triggerProps } = usePuzzlePreview()
  const [catalog,setCatalog]=useState<PuzzleCatalog|null>(null)
  const [error,setError]=useState('')
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    let active=true
    setError('')
    void api<PuzzleCatalog>('puzzles').then(value=>{if(active)setCatalog(value)}).catch(err=>{if(active)setError(err instanceof Error?err.message:'Could not load puzzles.')})
    return ()=>{active=false}
  },[retry])
  return <>
    <section className="account-hero"><p className="account-eyebrow">THE CHEESE MENU</p><h1>Puzzles</h1><p>Shared difficulties, learned from everyone’s rated challenges. Hover over a puzzle to preview its score, or tap to open it.</p></section>
    <section className="profile-card">
      {!catalog&&!error&&<p role="status">Loading puzzles…</p>}
      {error&&<p role="alert">{error} <button onClick={()=>setRetry(value=>value+1)}>Retry</button></p>}
      {catalog&&<div className="leaderboard-table-wrap"><table className="leaderboard-table"><caption className="sr-only">Puzzles ordered by shared difficulty</caption><thead><tr><th scope="col">Puzzle</th><th scope="col">Difficulty</th><th scope="col">Uncertainty</th><th scope="col">Rated runs</th></tr></thead><tbody>{[...catalog.puzzles].sort((a,b)=>a.rating-b.rating||a.title.localeCompare(b.title)).map(puzzle => {
        const trigger = triggerProps(puzzle.id, puzzle.levelId)
        return <tr key={puzzle.id}><th scope="row">{trigger ? <button {...trigger}>{puzzle.title}<span aria-hidden="true"> ♩</span></button> : puzzle.title}</th><td>{Math.round(puzzle.rating)}{puzzle.rd>110?'?':''}</td><td>{Math.round(puzzle.rd)}</td><td>{puzzle.games}</td></tr>
      })}</tbody></table></div>}
      <p className="account-note">Lower ratings mean easier puzzles. ? means provisional. Rated play chooses a challenge near your ability.</p>
      <p className="account-note">Your wins, draws and losses are in <a href="/profile">My profile</a>.</p>
    </section>
    {preview&&<PuzzlePreview id={previewId} preview={preview} onClose={close}/>}
  </>
}
