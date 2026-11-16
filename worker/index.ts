import { getAccount, logout, sendCode, session, verifyCode } from './auth'
import { body, HttpError, json, type Env } from './http'
import { updateProfile } from './profile'
import { readLeaderboard, readProfile, readPuzzles, readRatings } from './ratingReads'
import { submit } from './results'

async function api(request: Request, env: Env) {
  const { pathname, origin, searchParams } = new URL(request.url)
  const route = `${request.method} ${pathname}`
  if (request.method === 'POST' && request.headers.get('Origin') !== origin) {
    throw new HttpError(403, 'Use the game website to make this request.')
  }
  if (route === 'POST /api/auth/code') return sendCode(request, env)
  if (route === 'POST /api/auth/verify') return verifyCode(request, env)

  if (route === 'GET /api/leaderboard') return json(await readLeaderboard(env.DB, searchParams))
  if (route === 'GET /api/puzzles') return json(await readPuzzles(env.DB))

  const auth = await session(request, env)
  if (route === 'GET /api/me') return getAccount(request, env, auth)
  if (route === 'POST /api/auth/logout') return logout(request, env, auth)
  if (!auth) throw new HttpError(401, 'Sign in to save rated runs.')

  const userId = auth.user.id
  if (route === 'GET /api/profile') return json(await readProfile(env.DB, userId))
  if (route === 'POST /api/profile') return json(await updateProfile(request, env, userId))
  if (route === 'GET /api/ratings') return json(await readRatings(env.DB, userId))
  if (route === 'POST /api/results') return json(await submit(env, auth.user, await body(request)))
  throw new HttpError(404, 'API route not found.')
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try { return await api(request, env) }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      console.error('API failure', error instanceof Error ? error.message : 'Unknown error')
      return json({ error: 'Something went wrong. Please retry.' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
