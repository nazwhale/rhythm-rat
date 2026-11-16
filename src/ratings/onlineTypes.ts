import type { Rating } from './glicko'
export type OnlineUser = { id: string; email: string; username: string }
export type PuzzleRating = Rating & { id: string; levelId: string; title: string; games: number }
export type RecentResult = { id: string; puzzleId: string; levelId: string; won: boolean; draw: boolean; score: number; acceptedAt: number }
export type RatingsSnapshot = { ratingModelId: string; userId: string; player: Rating & { games: number }; puzzles: PuzzleRating[]; recent: RecentResult[] }
export type PendingResult = { id: string; userId: string; puzzleId: string; score: number; deferred?: boolean }
export type Submission = { ratingModelId: string; duplicate: boolean; delta: number | null; player?: Rating; puzzle?: Rating }

export type RatingPoint = { id: string; at: number; rating: number }
export type Profile = { ratingModelId: string; initialRating: number; id: string; username: string; createdAt: number; rating: number; rd: number; games: number; wins: number; draws: number; results: (RecentResult & { title: string; rating: number; previewLevelId?: string })[]; history: RatingPoint[]; olderResultsMissing: number }
export type Leaderboard = { ratingModelId: string; entries: { rank: number; id: string; username: string; rating: number; rd: number; games: number }[]; total: number; offset: number; limit: number }

export type PuzzleCatalog = { ratingModelId: string; puzzles: PuzzleRating[] }
