import { useCallback, useEffect, useRef, useState } from 'react'
import type { Level } from '../level'
import { api, ApiError } from './api'
import { pendingResults, removeResult, retainResult } from './outbox'
import { completedBite, startSecondBite, type RatedRun } from './ratedRun'
import { holdRun, withAvailableRun } from './runLock'
import { recommendIndex } from './recommend'
import type { OnlineUser, PendingResult, RatingsSnapshot, Submission } from './onlineTypes'

export function useOnlineRatings(levels: Level[]) {
  const [user, setUser] = useState<OnlineUser | null>(null)
  const [snapshot, setSnapshot] = useState<RatingsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [delta, setDelta] = useState<number | null>(null)
  const state = useRef<{ user: OnlineUser | null; snapshot: RatingsSnapshot | null }>({ user: null, snapshot: null })
  const deltaModel = useRef<string | null>(null)
  const active = useRef<(RatedRun & { release: () => Promise<void> }) | null>(null)
  const memoryPending = useRef(new Map<string, PendingResult>())
  const flushing = useRef(false)
  const flushAgain = useRef(false)
  const startGeneration = useRef(0)
  const epoch = useRef(0)

  const refresh = useCallback(async () => {
    const account = state.current.user
    if (!account) return
    const data = await api<RatingsSnapshot>('ratings')
    if (state.current.user?.id !== account.id) return
    if (deltaModel.current && deltaModel.current !== data.ratingModelId) setDelta(null)
    state.current.snapshot = data; setSnapshot(data)
  }, [])
  const flush = useCallback(async function flush(): Promise<void> {
    if (!state.current.user) return
    if (flushing.current) { flushAgain.current = true; return }
    flushing.current = true
    const account = state.current.user
    try {
      const pendingById = new Map(pendingResults(localStorage, account.id).map(r => [r.id,r]))
      for (const result of memoryPending.current.values()) pendingById.set(result.id,result)
      for (const pending of pendingById.values()) {
        if (pending.userId !== account.id || state.current.user?.id !== account.id) continue
        await withAvailableRun(pending.id, async () => {
          if (state.current.user?.id !== account.id) return
          // Reread after acquiring: another tab may have resolved Second bite.
          const result = memoryPending.current.get(pending.id) ?? pendingResults(localStorage, account.id).find(r => r.id === pending.id)
          if (!result) return
          if (result.deferred) {
            result.deferred = false // Its owner left; retain the completed first-bite loss.
            retainResult(localStorage, result)
          }
          setSaveStatus('Saving…')
          const saved = await api<Submission>('results', { id:result.id, puzzleId:result.puzzleId, score:result.score, userId:result.userId })
          removeResult(localStorage, result); memoryPending.current.delete(result.id)
          window.dispatchEvent(new Event('rhythm-rat:ratings-saved'))
          if (state.current.user?.id !== account.id) return
          deltaModel.current = saved.ratingModelId
          setDelta(saved.delta); setSaveStatus('Saved')
        })
      }
      if (state.current.user?.id === account.id) { await refresh(); setError('') }
    } catch (err) {
      if (state.current.user?.id === account.id) {
        setSaveStatus('Retry needed')
        setError(err instanceof Error ? err.message : 'Could not save your result.')
        if (err instanceof ApiError && err.status === 401) {
          state.current = { user:null, snapshot:null }; setUser(null); setSnapshot(null)
        }
      }
    } finally {
      flushing.current = false
      if (flushAgain.current) { flushAgain.current = false; void flush() }
    }
  }, [refresh])
  const acceptUser = useCallback(async (account: OnlineUser | null) => {
    state.current = { user: account, snapshot: null }; setUser(account); setSnapshot(null); setDelta(null); setError(''); setSaveStatus('')
    if (account) {
      try { await refresh(); await flush() }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not load ratings.') }
    }
  }, [flush, refresh])
  useEffect(() => {
    const generation = ++epoch.current
    void api<{ user: OnlineUser | null }>('me').then(async value => {
      if (generation === epoch.current) await acceptUser(value.user)
    }).catch(err => { if (generation === epoch.current) setError(err.message) })
      .finally(() => { if (generation === epoch.current) setLoading(false) })
    return () => { epoch.current++ }
  }, [acceptUser])
  useEffect(() => {
    const retry = () => { if (document.visibilityState === 'visible') void flush() }
    window.addEventListener('online', retry); window.addEventListener('focus', retry)
    const timer = window.setInterval(retry, 30000)
    return () => { window.removeEventListener('online', retry); window.removeEventListener('focus', retry); clearInterval(timer) }
  }, [flush])
  const retain = useCallback((result: PendingResult) => {
    setDelta(null)
    try { retainResult(localStorage, result); memoryPending.current.delete(result.id) }
    catch { memoryPending.current.set(result.id,result); setError('Could not retain this result in browser storage. Keep this tab open and retry saving.'); setSaveStatus('Retry needed') }
  }, [])
  const abandon = useCallback(() => {
    startGeneration.current++
    const run = active.current
    active.current = null
    if (!run) return
    if (run.stage !== 'first') {
      retain({id:run.id,userId:run.userId,puzzleId:run.puzzleId,score:0})
      setSaveStatus('Saving loss…')
    }
    void run.release().then(() => { if (run.stage !== 'first') void flush() })
  }, [retain, flush])
  useEffect(() => () => abandon(), [abandon])
  const start = useCallback(async (level: Level, attempt: number, _countInMs: number) => {
    if (!state.current.user || !state.current.snapshot) { setError('Sign in and load ratings before starting a rated run.'); return false }
    if (attempt !== 1) {
      if (active.current && startSecondBite(active.current)) return true
      setError('This retry was already saved. Start another rated challenge.'); return false
    }
    abandon()
    const generation = ++startGeneration.current
    const puzzle = state.current.snapshot.puzzles.find(p => p.levelId === level.id)
    if (!puzzle) { setError('Reload the game to load this puzzle.'); return false }
    try {
      const key='rhythm-rat:storage-check'; localStorage.setItem(key,'1'); localStorage.removeItem(key)
      const id=crypto.randomUUID(), userId=state.current.user.id
      const release=await holdRun(id)
      if (generation !== startGeneration.current || userId !== state.current.user?.id) { await release(); return false }
      active.current = { id,userId,puzzleId:puzzle.id,stage:'first',release }
      return true
    } catch (err) { setError(err instanceof Error ? err.message : 'Browser storage is unavailable. Switch to Unrated.'); return false }
  }, [abandon])
  const finish = useCallback((won: boolean, _counts?: unknown) => {
    const run=active.current
    if (!run) return
    const result=completedBite(run,won)
    if (!result) return
    retain(result)
    if (result.deferred) {
      setSaveStatus('Second bite: pass for a draw; leave to save a loss')
      return
    }
    active.current=null
    setSaveStatus('Saving…'); void run.release().then(() => flush())
  }, [retain, flush])
  const recommend = useCallback((easierThan?: Level, candidates: Level[] = levels) => {
    const data = state.current.snapshot
    if (!data || !candidates.length) return 0
    const entries = candidates.flatMap(level => {
      const rating = data.puzzles.find(p => p.levelId === level.id)
      return rating ? [{ id: rating.id, rating, level }] : []
    })
    if (!entries.length) return 0
    const ceiling = candidates.some(l => l.id === easierThan?.id) ? data.puzzles.find(p => p.levelId === easierThan?.id) : undefined
    const chosen = entries[recommendIndex(data.player, entries, data.recent.map(r => r.puzzleId), ceiling)]
    return Math.max(0, levels.findIndex(l => l.id === chosen.level.id))
  }, [levels])
  const logout = useCallback(async () => {
    abandon(); await flush()
    await api('auth/logout', {})
    await acceptUser(null)
  }, [abandon, flush, acceptUser])
  return { user, snapshot, loading, error, saveStatus, delta, ready: !!snapshot && !!user, acceptUser, start, finish, abandon, recommend, retry: flush, logout }
}
