export const HIT_WINDOW_SECONDS = 0.12

export function judgeTap(elapsed: number, nextNoteSeconds: number | undefined, countingIn: boolean): 'ignore' | 'extra' | 'perfect' | 'good' {
  // Preserve the first note's early allowance without penalising count-in taps.
  if (countingIn && elapsed < -HIT_WINDOW_SECONDS) return 'ignore'
  if (nextNoteSeconds === undefined) return 'extra'
  const delta = Math.abs(elapsed - nextNoteSeconds)
  if (delta > HIT_WINDOW_SECONDS) return 'extra'
  return delta <= 0.06 ? 'perfect' : 'good'
}

export function judgeRelease(elapsed: number, endSeconds: number): 'early' | 'late' | 'complete' {
  if (elapsed < endSeconds - HIT_WINDOW_SECONDS) return 'early'
  if (elapsed > endSeconds + HIT_WINDOW_SECONDS) return 'late'
  return 'complete'
}
