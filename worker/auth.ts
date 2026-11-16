import type { GetResponses, OnlineUser, PostResponse } from '../src/shared/apiContract'
import { body, HttpError, json, type Env } from './http'
import { loginEmail } from './loginEmail'
import { randomUsername } from './usernames'

const YEAR = 365 * 24 * 60 * 60
const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('')
const hash = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
async function codeHash(env: Env, email: string, code: string) {
  if (!env.AUTH_SECRET) throw new HttpError(503, 'Email login is not configured yet.')
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${email}:${code}`)))
}
function cookie(value: string, request: Request, maxAge = YEAR) {
  return `rr_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
async function ensureUsername(env: Env, user: OnlineUser) {
  if (user.username) return user
  // Covers a signup handled by the previous Worker during an additive migration.
  for (let tries = 0; tries < 8; tries++) {
    const name = randomUsername() + (tries >= 3 ? crypto.randomUUID().slice(0, 6) : '')
    try {
      await env.DB.prepare('UPDATE users SET username=? WHERE id=? AND username IS NULL').bind(name, user.id).run()
      return (await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first<OnlineUser>())!
    } catch (error) { if (tries === 7 || !/UNIQUE constraint failed: users.username/.test(String(error))) throw error }
  }
  return user
}
export async function session(request: Request, env: Env) {
  const value = request.headers.get('Cookie')?.match(/(?:^|;\s*)rr_session=([a-f0-9]{64})(?:;|$)/)?.[1]
  if (!value) return null
  const digest = await hash(value)
  const user = await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(digest, Date.now()).first<OnlineUser>()
  return user ? { user: await ensureUsername(env, user), digest, value } : null
}
function emailOf(value: unknown) {
  if (typeof value !== 'string') throw new HttpError(400, 'Enter your email address.')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  return email
}

export async function sendCode(request: Request, env: Env) {
  const email = emailOf((await body(request)).email)
  const now = Date.now()
  // Rejection sampling avoids modulo bias for four-digit codes.
  let n: number
  do { n = crypto.getRandomValues(new Uint16Array(1))[0] } while (n >= 60000)
  const code = String(n % 10000).padStart(4, '0')
  const digest = await codeHash(env, email, code)
  const saved = await env.DB.prepare('INSERT INTO login_codes(email,code_hash,expires_at,guesses,resend_at) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,guesses=0,resend_at=excluded.resend_at WHERE login_codes.resend_at<=? RETURNING email').bind(email, digest, now + 600000, now + 60000, now).first()
  if (!saved) throw new HttpError(429, 'Wait 60 seconds before requesting another code.')
  try {
    if (env.LOCAL_EMAIL === 'true') console.log(`LOCAL LOGIN ${email}: ${code}`)
    else await env.EMAIL.sendEmail({ to: email, ...loginEmail(code) })
  } catch {
    await env.DB.prepare('DELETE FROM login_codes WHERE email=? AND code_hash=?').bind(email, digest).run()
    throw new HttpError(502, 'Could not send your code. Please try again.')
  }
  return json<PostResponse<'auth/code'>>({ sent: true })
}

export async function verifyCode(request: Request, env: Env) {
  const data = await body(request), email = emailOf(data.email)
  if (typeof data.code !== 'string' || !/^\d{4}$/.test(data.code)) throw new HttpError(400, 'Enter the four-digit code.')
  const digest = await codeHash(env, email, data.code), now = Date.now()
  // Count and compare in one write; concurrent guesses cannot bypass the limit.
  const attempt = await env.DB.prepare('UPDATE login_codes SET guesses=guesses+1 WHERE email=? AND expires_at>? AND guesses<5 RETURNING code_hash,guesses').bind(email, now).first<{ code_hash: string; guesses: number }>()
  if (!attempt || attempt.code_hash !== digest) throw new HttpError(400, 'Incorrect or expired code. Request another code if needed.')
  const consumed = await env.DB.prepare('DELETE FROM login_codes WHERE email=? AND code_hash=? AND expires_at>? RETURNING email').bind(email, digest, now).first()
  if (!consumed) throw new HttpError(400, 'Code already used. Request another code.')
  const value = token(), sessionHash = await hash(value)
  for (let tries = 0; ; tries++) {
    const username = randomUsername() + (tries >= 3 ? crypto.randomUUID().slice(0, 6) : '')
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO users(id,email,username,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(), email, username, now),
        env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) SELECT ?,id,? FROM users WHERE email=?').bind(sessionHash, now + YEAR * 1000, email),
      ])
      break
    } catch (error) {
      if (tries >= 7 || !/UNIQUE constraint failed: users.username/.test(String(error))) throw error
    }
  }
  const account = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first<OnlineUser>()
  if (!account) throw new Error('Verified account was not created')
  const named = await ensureUsername(env, account)
  const user = { id: named.id, email: named.email, username: named.username }
  return json<PostResponse<'auth/verify'>>({ user }, 200, { 'Set-Cookie': cookie(value, request) })
}

export async function getAccount(request: Request, env: Env, auth: Awaited<ReturnType<typeof session>>) {
  if (!auth) return json<GetResponses['me']>({ user: null })
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').bind(Date.now() + YEAR * 1000, auth.digest).run()
  return json<GetResponses['me']>({ user: { id: auth.user.id, email: auth.user.email, username: auth.user.username } }, 200, { 'Set-Cookie': cookie(auth.value, request) })
}

export async function logout(request: Request, env: Env, auth: Awaited<ReturnType<typeof session>>) {
  if (auth) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(auth.digest).run()
  return json<PostResponse<'auth/logout'>>({ ok: true }, 200, { 'Set-Cookie': cookie('', request, 0) })
}
