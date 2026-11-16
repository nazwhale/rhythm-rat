export type GamePhase = 'ready' | 'countin' | 'playing' | 'finished' | 'lost'
export type RunPhase = GamePhase | 'cleared'
export type RunEvent = 'prepare' | 'start' | 'downbeat' | 'clear' | 'arrive' | 'fail'

export function nextRunPhase(phase: RunPhase, event: RunEvent): RunPhase {
  switch (event) {
    case 'prepare': return 'ready'
    case 'start': return phase === 'ready' || phase === 'lost' ? 'countin' : phase
    case 'downbeat': return phase === 'countin' ? 'playing' : phase
    case 'clear': return phase === 'countin' || phase === 'playing' ? 'cleared' : phase
    case 'arrive': return phase === 'cleared' ? 'finished' : phase
    case 'fail': return phase === 'countin' || phase === 'playing' ? 'lost' : phase
  }
}

export type RunCounts = { perfect: number; good: number; miss: number; extra: number }
export function hasCompletedAllNotes(counts: RunCounts, totalOnsets: number, holding: boolean) {
  // A final tied note is not complete until its release has been judged successfully.
  return totalOnsets > 0 && !holding && counts.miss === 0 && counts.extra === 0 && counts.perfect + counts.good === totalOnsets
}
