import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'
import { createRunAudio, type BiteSound } from '../audio'
import { unlockedLayerCount } from '../groove'
import { createEvents, createOnsets, levelSeconds, nextChallenge, SCROLL_PIXELS_PER_SECOND, type Duration, type Level, type Onset } from '../level'
import { LEVELS } from '../levels'
import type { MusicInstruments } from '../musicInstruments'
import type { useOnlineRatings } from '../ratings/useOnlineRatings'
import type { Judgement } from '../RhythmNotation'
import { HIT_WINDOW_SECONDS, judgeTap, judgeRelease, type TapJudgement } from '../timing'
import { hasCompletedAllNotes, nextRunPhase, type RunCounts, type RunEvent, type RunPhase } from './runState'

const EMPTY: RunCounts = { perfect: 0, good: 0, miss: 0, extra: 0 }

type Ratings = Pick<ReturnType<typeof useOnlineRatings>, 'user' | 'loading' | 'ready' | 'start' | 'finish' | 'abandon' | 'recommend' | 'retry'>

export function useGameRun(lab: Ratings, eligibleLevels: Level[], loginOpen: boolean) {
  const rated = !!lab.user
  const recommendedAccount = useRef<string | null>(null)
  const [challenge, setChallenge] = useState({ levelIndex: 0, attempt: 1 })
  const level = LEVELS[challenge.levelIndex]
  const onsets = useMemo(() => createOnsets(level), [level])
  const events = useMemo(() => createEvents(level), [level])
  const hasHolds = onsets.some((note) => note.holdSeconds > 0)
  const totalSeconds = levelSeconds(level)
  const beatSeconds = 60 / level.bpm
  const countInSeconds = level.beatsPerBar * beatSeconds
  // Half a sixteenth separates the visual barline from the next downbeat.
  const barlineInsetPixels = beatSeconds / 8 * SCROLL_PIXELS_PER_SECOND
  const [scenerySeed, setScenerySeed] = useState(() => Math.floor(Math.random() * 0xffffffff))
  const phaseRef = useRef<RunPhase>('ready')
  const [runPhase, setRunPhase] = useState<RunPhase>('ready')
  const phase = runPhase === 'cleared' ? 'playing' : runPhase
  const movePhase = useCallback((event: RunEvent) => {
    const next = nextRunPhase(phaseRef.current, event)
    if (next !== phaseRef.current) {
      phaseRef.current = next
      setRunPhase(next)
    }
  }, [])
  const [elapsed, setElapsed] = useState(-4 * 60 / LEVELS[0].bpm)
  const [countdown, setCountdown] = useState(4)
  const [muted, setMuted] = useState(false)
  const [marks, setMarks] = useState<Record<number, Judgement>>({})
  const [feedback, setFeedback] = useState<{ id: number; seconds: number; label: string; tone: string }[]>([])
  const [notice, setNotice] = useState('')
  const [sound, setSound] = useState<BiteSound>('flute')
  const feedbackId = useRef(0)
  const allNotesCleared = runPhase === 'cleared' || runPhase === 'finished'
  const [bitePulse, setBitePulse] = useState(0)
  const [bite, setBite] = useState<{ duration: Duration; variant: number }>({ duration: 'q', variant: 0 })
  const [eating, setEating] = useState(false)
  const [stumble, setStumble] = useState(false)
  const [holdingIndex, setHoldingIndex] = useState<number | null>(null)
  const activeHold = useRef<{ onset: Onset; result: TapJudgement } | null>(null)
  const lastMunch = useRef(0)
  const synthRef = useRef<ReturnType<typeof createRunAudio> | null>(null)
  const gameStart = useRef(0)
  const runGeneration = useRef(0)
  const judged = useRef(new Set<number>())
  const completedBars = useRef(0)
  const [musicStyle, setMusicStyle] = useState('')
  const [musicInstruments, setMusicInstruments] = useState<MusicInstruments | null>(null)
  const [barStreak, setBarStreak] = useState(0)
  const countsRef = useRef({ ...EMPTY })
  const animFrame = useRef<number | undefined>(undefined)
  const biteTimer = useRef<number | undefined>(undefined)

  useEffect(() => { synthRef.current?.setMuted(muted) }, [muted])
  useEffect(() => { synthRef.current?.setSound(sound) }, [sound])

  useEffect(() => () => {
    runGeneration.current++
    synthRef.current?.dispose()
    window.clearTimeout(biteTimer.current)
  }, [])

  const setMark = useCallback((index: number, result: Judgement) => {
    setMarks((old) => ({ ...old, [index]: result }))
  }, [])

  const updateCount = useCallback((result: keyof RunCounts) => {
    countsRef.current[result]++
  }, [])

  const showFeedback = useCallback((label: string, style: Judgement | 'early', seconds?: number) => {
    const position = seconds ?? Tone.getContext().rawContext.currentTime - gameStart.current
    setFeedback((old) => [...old.slice(-7), { id: ++feedbackId.current, seconds: position, label, tone: style }])
  }, [])

  const prepare = useCallback((next: { levelIndex: number; attempt: number }, message = '', finalLoss = false) => {
    setScenerySeed(Math.floor(Math.random() * 0xffffffff))
    completedBars.current = 0; setBarStreak(0)
    runGeneration.current++
    synthRef.current?.dispose(); synthRef.current = null
    if (animFrame.current) cancelAnimationFrame(animFrame.current)
    window.clearTimeout(biteTimer.current)
    activeHold.current = null; setHoldingIndex(null)
    judged.current = new Set(); countsRef.current = { ...EMPTY }
    setChallenge(next)
    movePhase(finalLoss ? 'fail' : 'prepare')
    const nextLevel = LEVELS[next.levelIndex]
    setElapsed(-nextLevel.beatsPerBar * 60 / nextLevel.bpm)
    setCountdown(4); setMarks({}); setFeedback([])
    setEating(false); setStumble(false); setNotice(message)
  }, [movePhase])

  useEffect(() => {
    if (lab.loading) return
    if (!lab.user) {
      if (recommendedAccount.current) {
        lab.abandon(); prepare({ levelIndex: challenge.levelIndex, attempt: 1 })
      }
      recommendedAccount.current = null
      return
    }
    if (!lab.ready || recommendedAccount.current === lab.user.id) return
    recommendedAccount.current = lab.user.id
    prepare({ levelIndex: lab.recommend(undefined, eligibleLevels), attempt: 1 })
  }, [prepare, lab.recommend, lab.abandon, eligibleLevels, lab.loading, lab.user, lab.ready, challenge.levelIndex])

  const finish = useCallback(() => {
    const result = countsRef.current
    const complete = hasCompletedAllNotes(result, onsets.length, activeHold.current !== null)
    if (rated && phaseRef.current !== 'cleared') lab.finish(complete)
    if (!complete) {
      const poolIndex = Math.max(0, eligibleLevels.findIndex((candidate) => candidate.id === level.id))
      const next = nextChallenge({ levelIndex: poolIndex, attempt: challenge.attempt }, false, eligibleLevels.length)
      if (rated && next.attempt === 1) next.levelIndex = lab.recommend(level, eligibleLevels)
      else next.levelIndex = LEVELS.indexOf(eligibleLevels[next.levelIndex] ?? eligibleLevels[0])
      prepare(next, next.attempt > 1 ? 'Second bite' : '', next.attempt === 1)
      return
    }
    synthRef.current?.continueMusic()
    movePhase('clear'); movePhase('arrive'); setElapsed(totalSeconds)
    activeHold.current = null; setHoldingIndex(null); setEating(false)
    window.clearTimeout(biteTimer.current)
    if (animFrame.current) cancelAnimationFrame(animFrame.current)
  }, [challenge, onsets.length, prepare, movePhase, totalSeconds, rated, lab.finish, lab.recommend, level, eligibleLevels])

  const secureCompletedRun = useCallback(() => {
    if (phaseRef.current === 'cleared' || !hasCompletedAllNotes(countsRef.current, onsets.length, activeHold.current !== null)) return
    // The player has done every required gesture. Secure the win now so an eager
    // tap (or a refresh before the rat reaches the hole) cannot turn it into a loss.
    // Keep the clock running to preserve the last bar's music and disco arrival.
    movePhase('clear')
    if (rated) lab.finish(true)
  }, [onsets.length, rated, lab.finish, movePhase])

  const beginPending = useRef(false)
  const begin = useCallback(async () => {
    if (beginPending.current || (phaseRef.current !== 'ready' && phaseRef.current !== 'lost')) return
    if (loginOpen || lab.loading) return
    if (rated && !lab.ready) { void lab.retry(); return }
    beginPending.current = true
    try {
      const generation = ++runGeneration.current
      await Tone.start()
      if (generation !== runGeneration.current) return
      if (rated && !await lab.start(level, challenge.attempt)) return
      if (generation !== runGeneration.current) { lab.abandon(); return }
      Tone.Transport.stop()
      Tone.Transport.cancel()
      Tone.Transport.position = 0
      setScenerySeed(Math.floor(Math.random() * 0xffffffff))
      completedBars.current = 0; setBarStreak(0)
      judged.current = new Set()
      activeHold.current = null; setHoldingIndex(null)
      countsRef.current = { ...EMPTY }
      setMarks({}); setElapsed(-countInSeconds)
      setEating(false); setStumble(false)
      window.clearTimeout(biteTimer.current)
      movePhase('start'); setCountdown(level.beatsPerBar); setFeedback([])
      const ctx = Tone.getContext().rawContext
      synthRef.current?.dispose()
      const audio = createRunAudio(muted, sound)
      synthRef.current = audio
      setMusicInstruments(audio.musicInstruments)
      setMusicStyle(audio.styleName)
      const synth = audio.metronome
      const now = ctx.currentTime + 0.12
      const beat = beatSeconds
      gameStart.current = now + countInSeconds
      // Keep the count-in clear, then tuck the click underneath the groove.
      synth.volume.setValueAtTime(-7, gameStart.current)
      for (let i = 0; i < level.beatsPerBar; i++) synth.triggerAttackRelease(i === 0 ? 'C6' : 'G5', '32n', now + i * beat, 0.34)
      for (let i = 0; i < level.bars.length * level.beatsPerBar; i++) {
        synth.triggerAttackRelease(i % level.beatsPerBar === 0 ? 'C6' : 'G5', '32n', gameStart.current + i * beat, 0.2)
      }
    } finally { beginPending.current = false }
  }, [muted, sound, level, countInSeconds, beatSeconds, rated, challenge.attempt, lab.start, lab.abandon, lab.ready, lab.user, lab.loading, lab.retry, loginOpen, movePhase])

  useEffect(() => {
    if (phase !== 'countin' && phase !== 'playing') return
    const tick = () => {
      const now = Tone.getContext().rawContext.currentTime
      if (phase === 'countin') {
        const remaining = Math.min(level.beatsPerBar, Math.max(0, Math.ceil((gameStart.current - now) / beatSeconds)))
        setCountdown(remaining)
        if (now >= gameStart.current) movePhase('downbeat')
      }
      const current = now - gameStart.current
      setElapsed(Math.max(-countInSeconds, Math.min(current, totalSeconds)))
      if (now >= gameStart.current) {
        const hold = activeHold.current
        if (hold && judgeRelease(current, hold.onset.endSeconds) === 'late') {
          setMark(hold.onset.index, 'miss'); updateCount('miss'); showFeedback('RELEASE', 'miss'); setStumble(true); finish(); return
        }
        if (hold && current - lastMunch.current >= 0.16) {
          synthRef.current?.munch(); lastMunch.current = current
        }
        for (const onset of onsets) {
          if (activeHold.current?.onset.index !== onset.index && !judged.current.has(onset.index) && current > onset.seconds + HIT_WINDOW_SECONDS) {
            judged.current.add(onset.index); setMark(onset.index, 'miss'); updateCount('miss'); showFeedback('MISS', 'miss'); setStumble(true)
            finish()
            return
          }
        }
        // A bar counts only after its notes (including tied holds) succeed.
        // The short lookahead lets the new layer enter on the next downbeat.
        while (completedBars.current < level.bars.length &&
          current + 0.08 >= (completedBars.current + 1) * level.beatsPerBar * beatSeconds &&
          onsets.filter((note) => note.bar <= completedBars.current).every((note) => judged.current.has(note.index))) {
          completedBars.current++
          setBarStreak(completedBars.current)
        }
        synthRef.current?.groove(gameStart.current, beatSeconds, unlockedLayerCount(completedBars.current))
        if (current > totalSeconds + 0.4) { finish(); return }
      }
      animFrame.current = requestAnimationFrame(tick)
    }
    animFrame.current = requestAnimationFrame(tick)
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current) }
  }, [phase, finish, movePhase, setMark, showFeedback, updateCount, level, onsets, countInSeconds, beatSeconds, totalSeconds])

  const advance = useCallback(() => {
    const next = rated
      ? { levelIndex: lab.recommend(undefined, eligibleLevels, challenge.attempt === 1), attempt: 1 }
      : (() => {
        const poolIndex = eligibleLevels.findIndex((candidate) => candidate.id === level.id)
        return { levelIndex: LEVELS.indexOf(eligibleLevels[(poolIndex + 1) % eligibleLevels.length]), attempt: 1 }
      })()
    prepare(next)
  }, [prepare, rated, lab.recommend, eligibleLevels, level, challenge.attempt])

  const selectLevel = useCallback((levelIndex: number) => {
    if (LEVELS[levelIndex]) { lab.abandon(); prepare({ levelIndex, attempt: 1 }) }
  }, [prepare, lab.abandon])

  const press = useCallback(() => {
    const phase = phaseRef.current
    if (phase === 'lost') return
    if (phase === 'finished') { advance(); return }
    if (phase === 'ready') { void begin(); return }
    if (phase === 'cleared') return
    const now = Tone.getContext().rawContext.currentTime - gameStart.current
    if (activeHold.current) { updateCount('extra'); setStumble(true); finish(); return }
    const candidate = onsets.find((item) => !judged.current.has(item.index))
    const result = judgeTap(now, candidate?.seconds, phase === 'countin')
    if (result === 'ignore') return
    if (result === 'extra' || !candidate) {
      updateCount('extra')
      showFeedback(candidate && now < candidate.seconds ? 'EARLY' : 'EXTRA', 'early')
      setStumble(true)
      finish()
      return
    }
    if (candidate.holdSeconds > 0) {
      activeHold.current = { onset: candidate, result }
      setHoldingIndex(candidate.index); lastMunch.current = now
      showFeedback(result === 'perfect' ? 'Perfect' : result === 'good' ? 'Good' : result === 'early' ? 'Early' : 'Late', result, candidate.seconds)
    } else {
      judged.current.add(candidate.index)
      setMark(candidate.index, result); updateCount(result === 'perfect' ? 'perfect' : 'good'); showFeedback(result === 'perfect' ? 'Perfect' : result === 'good' ? 'Good' : result === 'early' ? 'Early' : 'Late', result, candidate.seconds)
    }
    secureCompletedRun()
    const variant = (bite.variant + 1 + Math.floor(Math.random() * 2)) % 3
    setBite({ duration: candidate.duration, variant })
    synthRef.current?.munch(variant)
    setBitePulse((p) => p + 1); setEating(true)
    window.clearTimeout(biteTimer.current)
    if (!candidate.holdSeconds) biteTimer.current = window.setTimeout(() => setEating(false), 260)
  }, [begin, advance, onsets, setMark, updateCount, showFeedback, finish, bite.variant, secureCompletedRun])

  const release = useCallback(() => {
    const hold = activeHold.current
    if (!hold) return
    const now = Tone.getContext().rawContext.currentTime - gameStart.current
    activeHold.current = null; setHoldingIndex(null); setEating(false)
    if (judgeRelease(now, hold.onset.endSeconds) !== 'complete') {
      setMark(hold.onset.index, 'miss'); updateCount('miss'); showFeedback('HOLD MISSED', 'miss'); setStumble(true); finish(); return
    }
    judged.current.add(hold.onset.index)
    setMark(hold.onset.index, hold.result); updateCount(hold.result === 'perfect' ? 'perfect' : 'good')
    secureCompletedRun()
  }, [setMark, updateCount, showFeedback, finish, secureCompletedRun])

  const cancelActiveHold = useCallback(() => {
    if (!activeHold.current) return
    updateCount('miss'); setStumble(true); finish()
  }, [updateCount, finish])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      if (event.target instanceof HTMLElement && event.target.closest('select, input, textarea, button, summary, a')) return
      event.preventDefault(); press()
    }
    const onRelease = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (event.target instanceof HTMLElement && event.target.closest('select, input, textarea, button, summary, a')) return
      event.preventDefault(); release()
    }
    const onBlur = () => {
      if (phase === 'countin' || phase === 'playing') { lab.abandon(); prepare({ levelIndex: challenge.levelIndex, attempt: rated ? 1 : challenge.attempt }) }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onRelease)
    const onVisibility = () => { if (document.hidden) onBlur() }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onRelease)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [press, release, phase, rated, lab.abandon, prepare, challenge.levelIndex, challenge.attempt])

  function dismissFeedback(id: number) {
    setFeedback(items => items.filter(entry => entry.id !== id))
  }

  return {
    challenge, level, events, onsets, hasHolds, totalSeconds, beatSeconds, countInSeconds, barlineInsetPixels,
    scenerySeed, phase, elapsed, countdown, muted, setMuted, sound, setSound, marks, feedback, dismissFeedback,
    notice, setNotice, allNotesCleared, bitePulse, bite, eating, stumble, holdingIndex, barStreak, musicStyle,
    musicInstruments, perfect: countsRef.current.perfect === onsets.length,
    begin, prepare, selectLevel, press, release, cancelActiveHold,
  }
}
