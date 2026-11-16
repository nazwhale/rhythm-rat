import type { Rating } from '../ratings/glicko'
export type OnlineUser = { id: string; email: string; username: string }
export type PuzzleRating = Rating & { id: string; levelId: string; title: string; games: number }
export type RecentResult = { id: string; puzzleId: string; levelId: string; won: boolean; draw: boolean; score: number; acceptedAt: number }
export type RatingsSnapshot = { ratingModelId: string; userId: string; player: Rating & { games: number }; puzzles: PuzzleRating[]; recent: RecentResult[] }
export type Submission = { ratingModelId: string; duplicate: boolean; delta: number | null; player?: Rating; puzzle?: Rating }

export type RatingPoint = { id: string; at: number; rating: number }
export type Profile = { ratingModelId: string; initialRating: number; id: string; username: string; createdAt: number; rating: number; rd: number; games: number; wins: number; draws: number; results: (RecentResult & { title: string; rating: number; previewLevelId?: string })[]; history: RatingPoint[]; olderResultsMissing: number }
export type Leaderboard = { ratingModelId: string; entries: { rank: number; id: string; username: string; rating: number; rd: number; games: number }[]; total: number; offset: number; limit: number }

export type PuzzleCatalog = { ratingModelId: string; puzzles: PuzzleRating[] }

export type ResultScore = 0 | 0.5 | 1
type ResultRequest = { id: string; puzzleId: string; score: ResultScore; userId?: string }

export type GetResponses = {
  me: { user: OnlineUser | null }
  ratings: RatingsSnapshot
  profile: Profile
  puzzles: PuzzleCatalog
  leaderboard: Leaderboard
}

export type PostEndpoints = {
  'auth/code': { request: { email: string }; response: { sent: true } }
  'auth/verify': { request: { email: string; code: string }; response: { user: OnlineUser } }
  'auth/logout': { request: Record<string, never>; response: { ok: true } }
  profile: { request: { username: string }; response: { username: string } }
  results: { request: ResultRequest; response: Submission }
}

export type PostResponse<Path extends keyof PostEndpoints> = PostEndpoints[Path]['response']
