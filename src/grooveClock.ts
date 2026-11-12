// A continuous audio-time cursor, independent of level length or rendering.
export function createGrooveClock(onStep: (step: number, time: number, stepSeconds: number, layers: number) => void) {
  let nextStep = 0
  let config: { start: number; beatSeconds: number; layers: number } | null = null
  return {
    configure(start: number, beatSeconds: number, layers: number) { config = { start, beatSeconds, layers } },
    pump(now: number) {
      if (!config) return
      const { start, beatSeconds, layers } = config
      const stepSeconds = beatSeconds / 4
      nextStep = Math.max(nextStep, 0, Math.ceil((now - start) / stepSeconds))
      while (start + nextStep * stepSeconds < now + .08) {
        onStep(nextStep, start + nextStep * stepSeconds, stepSeconds, layers)
        nextStep++
      }
    },
  }
}
