export type GamePhase = 'ready' | 'countin' | 'playing' | 'finished' | 'lost'

export type RunCounts = { perfect: number; good: number; miss: number; extra: number }
export function hasCompletedAllNotes(counts: RunCounts, totalOnsets: number, holding: boolean) {
  // A final tied note is not complete until its release has been judged successfully.
  return totalOnsets > 0 && !holding && counts.miss === 0 && counts.extra === 0 && counts.perfect + counts.good === totalOnsets
}
