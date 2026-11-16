import type { PendingResult } from './onlineTypes'
export type RatedRun = { id: string; userId: string; puzzleId: string; stage: 'first' | 'waiting' | 'second' }
export function startSecondBite(run: RatedRun) {
  if (run.stage !== 'waiting') return false
  run.stage = 'second'
  return true
}
export function completedBite(run: RatedRun, won: boolean): PendingResult | null {
  // Duplicate completion callbacks cannot finish a second bite before it starts.
  if (run.stage === 'waiting') return null
  const result = { id:run.id,userId:run.userId,puzzleId:run.puzzleId,score:won ? (run.stage === 'first' ? 1 : 0.5) : 0 }
  if (!won && run.stage === 'first') { run.stage='waiting'; return {...result,deferred:true} }
  return result
}
