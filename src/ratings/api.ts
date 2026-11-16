export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, data === undefined ? { cache: 'no-store', signal: AbortSignal.timeout(15000) } : {
    signal: AbortSignal.timeout(15000), method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  const value = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, value?.error ?? 'Could not reach the game server.')
  return value as T
}
