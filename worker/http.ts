export type Env = { DB: D1Database; ASSETS: Fetcher; EMAIL: { sendEmail(message: { to: string; subject: string; text: string; html?: string }): Promise<{ id: string }> }; AUTH_SECRET: string; LOCAL_EMAIL?: string }

export class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }
export const json = <Body>(body: Body, status = 200, headers: HeadersInit = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

export async function body(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.')
  const raw = await request.text()
  if (raw.length > 4096) throw new HttpError(413, 'Request is too large.')
  try { const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string, unknown> }
  catch { throw new HttpError(400, 'Invalid JSON.') }
}
