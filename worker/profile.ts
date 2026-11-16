import type { PostResponse } from '../src/shared/apiContract'
import { body, HttpError, type Env } from './http'

export async function updateProfile(request: Request, env: Env, userId: string): Promise<PostResponse<'profile'>> {
  const data = await body(request)
  const username = typeof data.username === 'string' ? data.username.trim() : ''
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) throw new HttpError(400, 'Use 3–32 letters, numbers, hyphens or underscores.')
  try { await env.DB.prepare('UPDATE users SET username=? WHERE id=?').bind(username, userId).run() }
  catch (error) {
    if (/UNIQUE constraint failed: users.username/.test(String(error))) throw new HttpError(409, 'That username is taken. Try another one.')
    throw error
  }
  return { username }
}
