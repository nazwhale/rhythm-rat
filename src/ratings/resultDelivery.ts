import { pendingResults, removeResult, retainResult } from './outbox.ts'
import type { Submission } from '../shared/apiContract'
import type { PendingResult } from './onlineTypes.ts'

type DeliveryPorts = {
  storage: () => Storage
  withAvailableRun: (id: string, save: () => Promise<void>) => Promise<void>
  submit: (result: PendingResult) => Promise<Submission>
}

export function createResultDelivery({ storage, withAvailableRun, submit }: DeliveryPorts) {
  const inMemory = new Map<string, PendingResult>()

  function retain(result: PendingResult) {
    try {
      retainResult(storage(), result)
      inMemory.delete(result.id)
      return true
    } catch {
      inMemory.set(result.id, result)
      return false
    }
  }

  async function deliver(
    userId: string,
    isCurrent: () => boolean,
    onSaving: () => void,
    onSaved: (saved: Submission) => void,
  ) {
    const pending = new Map<string, PendingResult>()
    try {
      for (const result of pendingResults(storage(), userId)) pending.set(result.id, result)
    } catch (error) {
      if (![...inMemory.values()].some(result => result.userId === userId)) throw error
    }
    for (const result of inMemory.values()) {
      if (result.userId === userId) pending.set(result.id, result)
    }
    for (const id of pending.keys()) {
      if (!isCurrent()) return
      await withAvailableRun(id, async () => {
        if (!isCurrent()) return
        // Read again under the lock. Another tab may have saved or upgraded the loss.
        const result = inMemory.get(id) ?? pendingResults(storage(), userId).find(entry => entry.id === id)
        if (!result) return
        if (result.deferred) retain({ ...result, deferred: false })
        onSaving()
        const saved = await submit(result)
        if (inMemory.has(id)) {
          // A memory-only result can still be saved with storage blocked.
          try { removeResult(storage(), result) } catch { /* A retained copy can retry idempotently. */ }
        } else {
          removeResult(storage(), result)
        }
        inMemory.delete(id)
        onSaved(saved)
      })
    }
  }

  return { retain, deliver }
}
