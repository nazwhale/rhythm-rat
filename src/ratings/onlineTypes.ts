import type { ResultScore } from '../shared/apiContract'

export type PendingResult = { id: string; userId: string; puzzleId: string; score: ResultScore; deferred?: boolean }
