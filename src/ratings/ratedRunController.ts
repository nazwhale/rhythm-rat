import { completedBite, startSecondBite, type RatedRun } from './ratedRun.ts'
import type { PendingResult } from './onlineTypes.ts'

type ActiveRun = RatedRun & { release: () => Promise<void> }

export function createRatedRunController(
  holdRun: (id: string) => Promise<() => Promise<void>>,
  createId: () => string,
  retain: (result: PendingResult) => void,
  onReleased: () => void,
) {
  let active: ActiveRun | null = null
  let generation = 0

  function abandon() {
    generation++
    const run = active
    active = null
    if (!run) return
    const saveLoss = run.stage !== 'first'
    if (saveLoss) retain({ id: run.id, userId: run.userId, puzzleId: run.puzzleId, score: 0 })
    const didRelease = () => { if (saveLoss) onReleased() }
    void run.release().then(didRelease, didRelease)
  }

  async function start(userId: string, puzzleId: string, isCurrent: () => boolean) {
    abandon()
    const current = generation
    const id = createId()
    const release = await holdRun(id)
    if (current !== generation || !isCurrent()) {
      await release()
      return false
    }
    active = { id, userId, puzzleId, stage: 'first', release }
    return true
  }

  function retry(userId: string) {
    return active?.userId === userId && startSecondBite(active)
  }

  function finish(won: boolean) {
    const run = active
    if (!run) return
    const result = completedBite(run, won)
    if (!result) return
    retain(result)
    if (!result.deferred) {
      active = null
      void run.release().then(onReleased, onReleased)
    }
  }

  return { start, retry, finish, abandon }
}
