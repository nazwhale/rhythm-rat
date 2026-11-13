import { useCallback, useEffect, useRef, useState } from 'react'
import type { Level } from '../level'
import { beginAttempt, endAttempt, loadDB, newDB, recommendLevel, recoverOpenAttempts, saveDB, syncLevels, STORAGE_KEY, type Counts, type LabDB } from './store'

export function useLocalRatings(levels: Level[]) {
  const [initial] = useState(() => {
    try { return { db: loadDB(window.localStorage, levels), error: '' } }
    catch (error) { return { db: syncLevels(newDB(), levels), error: error instanceof Error ? error.message : 'Browser storage is unavailable.' } }
  })
  const [db, setDB] = useState(initial.db)
  const [error, setError] = useState(initial.error)
  const current = useRef(initial.db)
  const blocked = useRef(true)
  const ownsLock = useRef(false)
  const [ready, setReady] = useState(false)
  const [canReset, setCanReset] = useState(false)
  const active = useRef<{ attemptId: string; encounterId: string } | null>(null)
  const encounter = useRef<string | undefined>(undefined)
  const commit = useCallback((change: (db: LabDB) => LabDB) => {
    if (blocked.current) return false
    try {
      const next = saveDB(window.localStorage, change(current.current))
      current.current = next; setDB(next)
      return true
    } catch (error) {
      blocked.current = true
      setError(error instanceof Error ? error.message : 'Could not save ratings. Export your data before leaving.')
      return false
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    let release: (() => void) | undefined
    if (!navigator.locks) {
      setError('This local experiment needs a browser with Web Locks (such as Chrome on HTTPS or localhost).')
      return
    }
    void navigator.locks.request(STORAGE_KEY, { ifAvailable: true }, async (lock) => {
      if (cancelled) return
      if (!lock) { setError('The rating experiment is open in another tab. Close that tab and reload this one.'); return }
      ownsLock.current = true; setCanReset(true)
      blocked.current = !!initial.error
      if (!initial.error) {
        // Re-read only after acquiring the single-writer lock, then reconcile any old run.
        try { current.current = loadDB(window.localStorage, levels) }
        catch (error) { blocked.current = true; setError(error instanceof Error ? error.message : 'Could not read browser storage.') }
        if (!blocked.current && commit((value) => recoverOpenAttempts(value, Date.now()))) setReady(true)
      }
      await new Promise<void>((resolve) => { release = resolve })
      ownsLock.current = false
    }).catch(() => { if (!cancelled) setError('Could not open the local experiment. Reload to try again.') })
    return () => { cancelled = true; release?.() }
  }, [commit, initial.error, levels])
  const start = useCallback((level: Level, attempt: number, countInMs: number) => {
    let started: ReturnType<typeof beginAttempt> | undefined
    const saved = commit((value) => {
      started = beginAttempt(value, level, attempt, Date.now(), countInMs, encounter.current)
      return started.db
    })
    if (saved && started) { active.current = started; encounter.current = started.encounterId }
    return saved
  }, [commit])
  const finish = useCallback((won: boolean, counts: Counts) => {
    if (!active.current) return
    const attemptId = active.current.attemptId
    active.current = null
    commit((value) => endAttempt(value, attemptId, won ? 'win' : 'loss', Date.now(), counts))
  }, [commit])
  const abandon = useCallback(() => {
    if (active.current) {
      const attemptId = active.current.attemptId
      active.current = null
      commit((value) => {
        const attempt = value.attempts.find((entry) => entry.id === attemptId)!
        const now = Date.now()
        return endAttempt(value, attemptId, now < attempt.gameplayAt ? 'void' : 'loss', now, null, 'Changed level or left the run')
      })
    }
    encounter.current = undefined
  }, [commit])
  const recommend = useCallback((easierThan?: Level) => recommendLevel(current.current, levels, easierThan), [levels])
  const rename = useCallback((name: string) => { commit((value) => ({ ...value, user: { ...value.user, name: name.slice(0, 60) } })) }, [commit])
  const reset = useCallback(() => {
    if (!ownsLock.current) return false
    try {
      const next = syncLevels(newDB(), levels)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      current.current = next; setDB(next); setError(''); blocked.current = false; setReady(true)
      active.current = null; encounter.current = undefined
      return true
    } catch { setError('Browser storage is unavailable. Normal practice still works.'); return false }
  }, [levels])
  const exportData = useCallback(() => {
    let data = JSON.stringify(current.current, null, 2)
    // Preserve an incompatible saved file when offering recovery via export.
    if (initial.error) { try { data = window.localStorage.getItem(STORAGE_KEY) ?? data } catch { /* Export the in-memory copy. */ } }
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `rhythm-rat-ratings-${Date.now()}.json`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [initial.error])
  return { db, error, ready, canReset, start, finish, abandon, recommend, rename, reset, exportData }
}
