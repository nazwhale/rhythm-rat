import type { PendingResult } from './onlineTypes'
export const OUTBOX_PREFIX = 'rhythm-rat:pending:v1:'
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
export function pendingResults(storage: StoragePort, userId: string) {
  const results: PendingResult[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(`${OUTBOX_PREFIX}${userId}:`)) continue
    const value = JSON.parse(storage.getItem(key)!)
    if (value.score === undefined && typeof value.won === 'boolean') { value.score = value.won ? 1 : 0; delete value.won }
    if (value.userId !== userId || typeof value.id !== 'string' || typeof value.puzzleId !== 'string' || ![0,0.5,1].includes(value.score)) throw new Error('A pending result is invalid. Your saved data has been preserved.')
    results.push(value as PendingResult)
  }
  return results
}
export function retainResult(storage: StoragePort, result: PendingResult) {
  storage.setItem(`${OUTBOX_PREFIX}${result.userId}:${result.id}`, JSON.stringify(result))
}
export function removeResult(storage: StoragePort, result: PendingResult) {
  storage.removeItem(`${OUTBOX_PREFIX}${result.userId}:${result.id}`)
}
