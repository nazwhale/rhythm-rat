import type { GetResponses, PostEndpoints, PostResponse } from '../shared/apiContract'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request(path: string, data?: unknown): Promise<unknown> {
  const signal = AbortSignal.timeout(15000)
  const response = await fetch(`/api/${path}`, data === undefined ? { cache: 'no-store', signal } : {
    signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  const value = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, value?.error ?? 'Could not reach the game server.')
  return value
}

export const api = {
  async get<Path extends keyof GetResponses>(
    path: Path,
    ...args: Path extends 'leaderboard' ? [offset?: number] : []
  ): Promise<GetResponses[Path]> {
    const [offset] = args
    const url = offset === undefined ? path : `${path}?offset=${offset}`
    return await request(url) as GetResponses[Path]
  },
  async post<Path extends keyof PostEndpoints>(path: Path, data: PostEndpoints[Path]['request']): Promise<PostResponse<Path>> {
    return await request(path, data) as PostResponse<Path>
  },
}
