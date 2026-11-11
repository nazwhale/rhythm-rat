export const HIT_WINDOW_SECONDS = 0.12
export type TapJudgement = 'perfect' | 'good' | 'early' | 'late'
export function judgeTap(elapsed: number, nextNoteSeconds: number | undefined, countingIn: boolean): 'ignore' | 'extra' | TapJudgement {
  if (countingIn && elapsed < -HIT_WINDOW_SECONDS) return 'ignore'
  if (nextNoteSeconds === undefined) return 'extra'
  const delta = elapsed - nextNoteSeconds
  if (Math.abs(delta) > HIT_WINDOW_SECONDS) return 'extra'
  if (Math.abs(delta) <= 0.035) return 'perfect'
  if (Math.abs(delta) <= 0.075) return 'good'
  return delta < 0 ? 'early' : 'late'
}
export function judgeRelease(elapsed: number, endSeconds: number): 'early' | 'late' | 'complete' {
  if (elapsed < endSeconds - HIT_WINDOW_SECONDS) return 'early'
  if (elapsed > endSeconds + HIT_WINDOW_SECONDS) return 'late'
  return 'complete'
}
