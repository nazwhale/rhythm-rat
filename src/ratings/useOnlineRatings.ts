import { useCallback, useEffect, useRef, useState } from 'react'
import type { Level } from '../level'
import { api, ApiError } from './api'
import { createRatedRunController } from './ratedRunController'
import { createResultDelivery } from './resultDelivery'
import { holdRun, withAvailableRun } from './runLock'
import { recommendIndex } from './recommend'
import type { OnlineUser, RatingsSnapshot, Submission } from '../shared/apiContract'

type Account = { user: OnlineUser; snapshot: RatingsSnapshot | null }

export function useOnlineRatings(levels: Level[]) {
  // The ref holds the session identity for in-flight work. React gets a
  // fresh view when the account changes or a snapshot is accepted.
  const account = useRef<Account | null>(null)
  const [view, setView] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [saved, setSaved] = useState<Submission | null>(null)
  const [delivery] = useState(() => createResultDelivery({
    storage: () => localStorage,
    withAvailableRun,
    submit: ({ id, puzzleId, score, userId }) => api.post('results', { id, puzzleId, score, userId }),
  }))
  const flushing = useRef(false)
  const flushAgain = useRef(false)

  const refresh = useCallback(async (current: Account) => {
    const data = await api.get('ratings')
    if (account.current !== current || data.userId !== current.user.id) return
    current.snapshot = data
    setView({ ...current })
  }, [])

  const flush = useCallback(async function flush(): Promise<void> {
    const current = account.current
    if (!current) return
    if (flushing.current) { flushAgain.current = true; return }
    flushing.current = true
    const isCurrent = () => account.current === current
    try {
      await delivery.deliver(current.user.id, isCurrent, () => setSaveStatus('Saving…'), response => {
        window.dispatchEvent(new Event('rhythm-rat:ratings-saved'))
        if (!isCurrent()) return
        setSaved(response)
        setSaveStatus('Saved')
      })
      if (isCurrent()) {
        await refresh(current)
        if (isCurrent()) setError('')
      }
    } catch (err) {
      if (isCurrent()) {
        setSaveStatus('Retry needed')
        setError(err instanceof Error ? err.message : 'Could not save your result.')
        if (err instanceof ApiError && err.status === 401) {
          account.current = null
          setView(null)
        }
      }
    } finally {
      flushing.current = false
      if (flushAgain.current) { flushAgain.current = false; void flush() }
    }
  }, [delivery, refresh])

  const [runs] = useState(() => createRatedRunController(holdRun, () => crypto.randomUUID(), result => {
    setSaved(null)
    if (!delivery.retain(result)) {
      setError('Could not retain this result in browser storage. Keep this tab open and retry saving.')
      setSaveStatus('Retry needed')
    } else {
      setSaveStatus(result.deferred ? 'Second bite: pass for a draw; leave to save a loss' : 'Saving…')
    }
  }, () => void flush()))

  const acceptUser = useCallback(async (user: OnlineUser | null) => {
    runs.abandon()
    const current = user ? { user, snapshot: null } : null
    account.current = current
    setView(current && { ...current })
    setSaved(null)
    setError('')
    setSaveStatus('')
    if (!current) return
    try {
      await refresh(current)
      if (account.current === current) await flush()
    } catch (err) {
      if (account.current === current) setError(err instanceof Error ? err.message : 'Could not load ratings.')
    }
  }, [runs, flush, refresh])

  useEffect(() => {
    let mounted = true
    void api.get('me').then(async value => {
      if (mounted) await acceptUser(value.user)
    }).catch(err => { if (mounted) setError(err.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => {
      mounted = false
      // The releasing run can still deliver its saved loss after navigation.
      runs.abandon()
    }
  }, [acceptUser, runs])

  useEffect(() => {
    const retry = () => { if (document.visibilityState === 'visible') void flush() }
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    const timer = window.setInterval(retry, 30000)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('focus', retry)
      clearInterval(timer)
    }
  }, [flush])

  const start = useCallback(async (level: Level, attempt: number) => {
    const current = account.current
    if (!current?.snapshot) {
      setError('Sign in and load ratings before starting a rated run.')
      return false
    }
    if (attempt !== 1) {
      if (runs.retry(current.user.id)) return true
      setError('This retry was already saved. Start another rated challenge.')
      return false
    }
    const puzzle = current.snapshot.puzzles.find(entry => entry.levelId === level.id)
    if (!puzzle) {
      setError('Reload the game to load this puzzle.')
      return false
    }
    try {
      const key = 'rhythm-rat:storage-check'
      localStorage.setItem(key, '1')
      localStorage.removeItem(key)
      return await runs.start(current.user.id, puzzle.id, () => account.current === current)
    } catch (err) {
      if (account.current === current) setError(err instanceof Error ? err.message : 'Browser storage is unavailable.')
      return false
    }
  }, [runs])

  const recommend = useCallback((easierThan?: Level, candidates: Level[] = levels) => {
    const data = account.current?.snapshot
    if (!data || !candidates.length) return 0
    const entries = candidates.flatMap(level => {
      const rating = data.puzzles.find(p => p.levelId === level.id)
      return rating ? [{ id: rating.id, rating, level }] : []
    })
    if (!entries.length) return 0
    const ceiling = candidates.some(l => l.id === easierThan?.id) ? data.puzzles.find(p => p.levelId === easierThan?.id) : undefined
    const chosen = entries[recommendIndex(data.player, entries, data.recent.map(r => r.puzzleId), { easierThan: ceiling })]
    return Math.max(0, levels.findIndex(l => l.id === chosen.level.id))
  }, [levels])

  const user = view?.user ?? null
  const snapshot = view?.snapshot ?? null
  const delta = saved?.ratingModelId === snapshot?.ratingModelId ? saved?.delta ?? null : null
  return {
    user, snapshot, loading, error, saveStatus, delta, ready: !!snapshot && !!user,
    acceptUser, start, finish: runs.finish, abandon: runs.abandon, recommend, retry: flush,
  }
}
