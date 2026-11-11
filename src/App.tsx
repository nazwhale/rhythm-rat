import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import * as Tone from 'tone'
import { Cheese } from './Cheese'
import FinishHole from './FinishHole'
import CheeseBoard from './CheeseBoard'
import { createRunAudio, type BiteSound } from './audio'
import { RhythmNotation, type Judgement } from './RhythmNotation'
import { ATTEMPTS_PER_LEVEL, createEvents, createOnsets, levelSeconds, nextChallenge, SCROLL_PIXELS_PER_SECOND, type Onset } from './level'
import { LEVELS } from './levels'
import { HIT_WINDOW_SECONDS, judgeTap, judgeRelease, type TapJudgement } from './timing'

type Phase = 'ready' | 'countin' | 'playing' | 'finished'
type Counts = { perfect: number; good: number; miss: number; extra: number; longest: number }
const EMPTY: Counts = { perfect: 0, good: 0, miss: 0, extra: 0, longest: 0 }

function Rat({ eating, holding, stumble, pulse }: { eating: boolean; holding: boolean; stumble: boolean; pulse: number }) {
  return <div className={`rat ${eating ? 'eating' : ''} ${holding ? 'holding' : ''} ${stumble ? 'stumble' : ''}`} key={pulse}>
    <svg viewBox="0 0 32 20" shapeRendering="crispEdges" role="img" aria-label="Tiny pixel rat">
      <path fill="#d79391" d="M1 14h2v2h7v-2H4v-2H1z" />
      <path fill="#777c80" d="M8 9h3V7h9V5h6v3h2v2h2v2h2v3h-5v2H11v-2H8z" />
      <path fill="#9da2a4" d="M11 9h10V7h4v4h3v3H11z" />
      <path fill="#777c80" d="M20 3h5v6h-5z" />
      <path fill="#dca5a0" d="M21 4h3v3h-3z" />
      <path fill="#242d2c" d="M27 9h2v2h-2z" />
      <path fill="#dfaaa2" d="M31 12h1v2h-1z" />
      <path className="rat-jaw" fill="#dca5a0" d="M28 15h4v1h-4z" />
      <path className="rat-foot rat-foot-back" fill="#d79391" d="M12 17h4v2h-4z" />
      <path className="rat-foot rat-foot-front" fill="#d79391" d="M24 17h4v2h-4z" />
    </svg>
    {eating && <span className="cheese-crumbs" aria-hidden="true"><i/><i/><i/></span>}
  </div>
}

export default function App() {
  const [challenge, setChallenge] = useState({ levelIndex: 0, attempt: 1 })
  const level = LEVELS[challenge.levelIndex]
  const onsets = useMemo(() => createOnsets(level), [level])
  const events = useMemo(() => createEvents(level), [level])
  const hasHolds = onsets.some((note) => note.holdSeconds > 0)
  const totalSeconds = levelSeconds(level)
  const beatSeconds = 60 / level.bpm
  const countInSeconds = level.beatsPerBar * beatSeconds
  const [phase, setPhase] = useState<Phase>('ready')
  const [elapsed, setElapsed] = useState(-4 * 60 / LEVELS[0].bpm)
  const [countdown, setCountdown] = useState(4)
  const [muted, setMuted] = useState(false)
  const [marks, setMarks] = useState<Record<number, Judgement>>({})
  const [feedback, setFeedback] = useState<{ id: number; seconds: number; label: string; tone: string }[]>([])
  const [notice, setNotice] = useState('')
  const [sound, setSound] = useState<BiteSound>('nom')
  const feedbackId = useRef(0)
  const pointerId = useRef<number | null>(null)
  const [bitePulse, setBitePulse] = useState(0)
  const [eating, setEating] = useState(false)
  const [stumble, setStumble] = useState(false)
  const [holdingIndex, setHoldingIndex] = useState<number | null>(null)
  const activeHold = useRef<{ onset: Onset; result: TapJudgement } | null>(null)
  const lastMunch = useRef(0)
  const synthRef = useRef<ReturnType<typeof createRunAudio> | null>(null)
  const gameStart = useRef(0)
  const runGeneration = useRef(0)
  const judged = useRef(new Set<number>())
  const streakRef = useRef(0)
  const countsRef = useRef(EMPTY)
  const animFrame = useRef<number | undefined>(undefined)
  const biteTimer = useRef<number | undefined>(undefined)

  useEffect(() => { synthRef.current?.setMuted(muted) }, [muted])
  useEffect(() => { synthRef.current?.setSound(sound) }, [sound])

  useEffect(() => () => {
    synthRef.current?.dispose()
    window.clearTimeout(biteTimer.current)
  }, [])

  const setMark = useCallback((index: number, result: Judgement) => {
    setMarks((old) => ({ ...old, [index]: result }))
  }, [])

  const updateCount = useCallback((result: keyof Counts) => {
    const next = { ...countsRef.current, [result]: countsRef.current[result] + 1 }
    if (result === 'perfect' || result === 'good') {
      streakRef.current += 1
      next.longest = Math.max(next.longest, streakRef.current)
    } else {
      streakRef.current = 0
    }
    countsRef.current = next
  }, [])

  const showFeedback = useCallback((label: string, style: Judgement | 'early', seconds?: number) => {
    const position = seconds ?? Tone.getContext().rawContext.currentTime - gameStart.current
    setFeedback((old) => [...old.slice(-7), { id: ++feedbackId.current, seconds: position, label, tone: style }])
  }, [])

  const prepare = useCallback((next: { levelIndex: number; attempt: number }, message = '') => {
    runGeneration.current++
    synthRef.current?.dispose(); synthRef.current = null
    if (animFrame.current) cancelAnimationFrame(animFrame.current)
    window.clearTimeout(biteTimer.current)
    activeHold.current = null; setHoldingIndex(null); pointerId.current = null
    judged.current = new Set(); streakRef.current = 0; countsRef.current = { ...EMPTY }
    setChallenge(next); setPhase('ready')
    const nextLevel = LEVELS[next.levelIndex]
    setElapsed(-nextLevel.beatsPerBar * 60 / nextLevel.bpm)
    setCountdown(4); setMarks({}); setFeedback([])
    setEating(false); setStumble(false); setNotice(message)
  }, [])

  const finish = useCallback(() => {
    const result = countsRef.current
    const complete = result.miss === 0 && result.extra === 0 && result.perfect + result.good === onsets.length
    if (!complete) {
      const next = nextChallenge(challenge, false, LEVELS.length)
      prepare(next, next.levelIndex === challenge.levelIndex ? 'Second bite' : `Next up · ${LEVELS[next.levelIndex].title}`)
      return
    }
    setPhase('finished'); setElapsed(totalSeconds)
    activeHold.current = null; setHoldingIndex(null); setEating(false)
    window.clearTimeout(biteTimer.current)
    synthRef.current?.dispose(); synthRef.current = null
    if (animFrame.current) cancelAnimationFrame(animFrame.current)
  }, [challenge, onsets.length, prepare, totalSeconds])

  const begin = useCallback(async () => {
    const generation = ++runGeneration.current
    await Tone.start()
    if (generation !== runGeneration.current) return
    Tone.Transport.stop()
    Tone.Transport.cancel()
    Tone.Transport.position = 0
    judged.current = new Set()
    activeHold.current = null; setHoldingIndex(null)
    streakRef.current = 0
    countsRef.current = { ...EMPTY }
    setMarks({}); setElapsed(-countInSeconds)
    setEating(false); setStumble(false)
    window.clearTimeout(biteTimer.current)
    setPhase('countin'); setCountdown(level.beatsPerBar); setFeedback([])
    const ctx = Tone.getContext().rawContext
    synthRef.current?.dispose()
    const audio = createRunAudio(muted, sound)
    synthRef.current = audio
    const synth = audio.metronome
    const now = ctx.currentTime + 0.12
    const beat = beatSeconds
    gameStart.current = now + countInSeconds
    for (let i = 0; i < level.beatsPerBar; i++) synth.triggerAttackRelease(i === 0 ? 'C6' : 'G5', '32n', now + i * beat, 0.34)
    for (let i = 0; i < level.bars.length * level.beatsPerBar; i++) {
      synth.triggerAttackRelease(i % level.beatsPerBar === 0 ? 'C6' : 'G5', '32n', gameStart.current + i * beat, 0.2)
    }
  }, [muted, sound, level, countInSeconds, beatSeconds])

  useEffect(() => {
    if (phase !== 'countin' && phase !== 'playing') return
    const tick = () => {
      const now = Tone.getContext().rawContext.currentTime
      if (phase === 'countin') {
        const remaining = Math.min(level.beatsPerBar, Math.max(0, Math.ceil((gameStart.current - now) / beatSeconds)))
        setCountdown(remaining)
        if (now >= gameStart.current) setPhase('playing')
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
        if (current > totalSeconds + 0.4) { finish(); return }
      }
      animFrame.current = requestAnimationFrame(tick)
    }
    animFrame.current = requestAnimationFrame(tick)
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current) }
  }, [phase, finish, setMark, showFeedback, updateCount, level, onsets, countInSeconds, beatSeconds, totalSeconds])

  const advance = useCallback(() => {
    prepare(nextChallenge(challenge, true, LEVELS.length))
  }, [challenge, prepare])

  const selectLevel = useCallback((levelIndex: number) => {
    if (LEVELS[levelIndex]) prepare({ levelIndex, attempt: 1 })
  }, [prepare])

  const press = useCallback(() => {
    if (phase === 'finished') { advance(); return }
    if (phase === 'ready') { void begin(); return }
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
    synthRef.current?.munch()
    setBitePulse((p) => p + 1); setEating(true)
    window.clearTimeout(biteTimer.current)
    if (!candidate.holdSeconds) biteTimer.current = window.setTimeout(() => setEating(false), 220)
  }, [phase, begin, advance, onsets, setMark, updateCount, showFeedback, finish])

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
  }, [setMark, updateCount, showFeedback, finish])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      if (event.target instanceof HTMLElement && event.target.closest('select, input, textarea, button')) return
      event.preventDefault(); press()
    }
    const onRelease = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (event.target instanceof HTMLElement && event.target.closest('select, input, textarea, button')) return
      event.preventDefault(); release()
    }
    const onBlur = () => {
      if (activeHold.current) { updateCount('miss'); setStumble(true); finish() }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onRelease)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onRelease)
      window.removeEventListener('blur', onBlur)
    }
  }, [press, release, updateCount, finish])

  const levelProgress = Math.max(0, Math.min(1, elapsed / totalSeconds))

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={(e) => e.preventDefault()}><span className="brand-mark">♪</span><span>RHYTHM<span className="brand-light">RAT</span></span></a>
      <div className="level-name"><span className="level-dot" /> LEVEL {String(challenge.levelIndex + 1).padStart(2, '0')} <b>·</b> {level.title.toUpperCase()}</div>
      <div className="sound-controls"><label htmlFor="bite-sound">Bite sound</label><select id="bite-sound" value={sound} onChange={(event) => setSound(event.target.value as BiteSound)}>
        <option value="nom">Soft nom</option><option value="crunch">Crunch</option><option value="pluck">Musical</option><option value="quiet">No bite sound</option>
      </select>
      <button className="sound-toggle" onClick={() => setMuted((v) => !v)} aria-label={muted ? 'Unmute sound' : 'Mute sound'}><span>{muted ? '◌' : '♫'}</span> {muted ? 'SOUND OFF' : 'SOUND ON'}</button></div>
    </header>

    <div className="admin-toolbar">
      <label htmlFor="admin-level">LEVEL PICKER</label>
      <select id="admin-level" value={challenge.levelIndex} onChange={(event) => selectLevel(Number(event.target.value))}>
        {LEVELS.map((item, index) => <option key={item.id} value={index}>{index + 1}. {item.title}</option>)}
      </select>
    </div>

    <section className="intro-row">
      <div><h1>Eat to the beat.</h1></div>
      <div className="howto"><div className="keycap"><span className="desktop-hint">SPACE</span><span className="touch-hint">TAP</span></div><p>{hasHolds ? 'Tap notes. Hold ties.' : 'Tap once for every note.'}<br/><span>{hasHolds ? 'Release at the tie target. Don’t press on rests.' : ''}</span></p></div>
    </section>

    <section className="game-card">
      <div className="game-heading"><div className="game-status"><strong className="time-signature" aria-label="4/4 time">4/4</strong><span className="live-dot" /> {phase === 'finished' ? 'Complete' : phase === 'countin' ? 'Count in' : level.title}</div><div className="bpm"><strong>{level.bpm}</strong><small>BPM</small><span className="divider" /><small>BAR {Math.min(level.bars.length, Math.max(1, Math.floor(elapsed / (level.beatsPerBar * beatSeconds)) + 1))} / {level.bars.length}</small></div></div>

      <div className={`runner-lane ${stumble ? 'lane-stumble' : ''} ${phase === 'finished' ? 'level-won' : ''}`}
        onPointerDown={(event) => {
          if (event.button !== 0 || pointerId.current !== null) return
          event.preventDefault(); pointerId.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId); press()
        }}
        onPointerUp={(event) => { if (pointerId.current === event.pointerId) { pointerId.current = null; release() } }}
        onPointerCancel={(event) => { if (pointerId.current === event.pointerId) { pointerId.current = null; if (activeHold.current) { updateCount('miss'); finish() } } }}
        onLostPointerCapture={(event) => { if (pointerId.current === event.pointerId) { pointerId.current = null; if (activeHold.current) { updateCount('miss'); finish() } } }}>
        {notice && <div key={notice + challenge.attempt + challenge.levelIndex} className="run-notice" onAnimationEnd={() => setNotice('')}>{notice}</div>}
        {phase === 'ready' && <div className="ready-cue"><span className="desktop-hint">Space to start</span><span className="touch-hint">Tap to start</span></div>}
      <div className="level-progress-row">

        <div className="level-progress-track" role="progressbar" aria-label="Level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(levelProgress * 100)}>
          <div className="progress-journey" aria-hidden="true">
            <div className="progress-path" />
            <div className="level-progress-fill" style={{ transform: `scaleX(${levelProgress})` }} />
            <svg className="progress-rat" viewBox="0 0 28 16" style={{ left: `${levelProgress * 100}%` }}>
              <path d="M10 11C3 14 0 10 3 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M8 10c0-4 3-6 7-6 3 0 5 2 6 3l5 3-4 2H11z" fill="currentColor" />
              <circle cx="19" cy="5" r="3" fill="currentColor" />
              <circle cx="22" cy="9" r=".8" fill="#f3f6ef" />
            </svg>
            <svg className="progress-home" viewBox="0 0 22 24">
              <path d="M2 23V12a9 9 0 0 1 18 0v11" fill="#dce4d6" />
              <path d="M5 23V12a6 6 0 0 1 12 0v11" fill="#465a49" />
              <path d="M1 23h20" stroke="#b8c7b0" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
        <div className="lane-topline" />
        <div className="ground-line" />
        <div className="ground-dashes" style={{ transform: `translateX(${-elapsed * SCROLL_PIXELS_PER_SECOND % 76}px)` }} />
        <div className="cheese-track" aria-hidden="true" style={{ transform: `translateX(${-elapsed * SCROLL_PIXELS_PER_SECOND}px)` }}>
          <RhythmNotation marks={marks} level={level} />
          {Array.from({ length: level.bars.length + 1 }, (_, index) => <span
            key={`bar-${index}`} className={`cheese-barline ${phase !== 'ready' && elapsed * SCROLL_PIXELS_PER_SECOND >= index * level.beatsPerBar * beatSeconds * SCROLL_PIXELS_PER_SECOND - 28 ? 'passed' : 'upcoming'}`}
            style={{ left: index * level.beatsPerBar * 60 / level.bpm * SCROLL_PIXELS_PER_SECOND - 28 }}
          />)}
          {level.bars.map((_, index) => <span key={`bar-label-${index}`} className="cheese-bar-label"
            style={{ left: index * level.beatsPerBar * beatSeconds * SCROLL_PIXELS_PER_SECOND }}>
            {index === level.bars.length / 2 ? 'Halfway' : `${level.bars.length - index} to go`}
          </span>)}
          {onsets.map((onset) => <div key={onset.index} className={`rhythm-cheese ${marks[onset.index] ?? ''} ${holdingIndex === onset.index ? 'being-eaten' : ''}`} style={{ left: onset.seconds * SCROLL_PIXELS_PER_SECOND }}>
            {onset.holdSeconds > 0 && <span className="cheese-strip" style={{ width: onset.holdSeconds * SCROLL_PIXELS_PER_SECOND, clipPath: `inset(0 0 0 ${holdingIndex === onset.index ? Math.max(0, Math.min(100, (elapsed - onset.seconds) / onset.holdSeconds * 100)) : 0}%)` }} />}

          </div>)}
          <FinishHole tier={challenge.levelIndex} celebrating={phase === 'finished'} left={totalSeconds * SCROLL_PIXELS_PER_SECOND} />
          {feedback.map((item) => <span key={item.id} className={`note-feedback ${item.tone}`}
            style={{ left: item.seconds * SCROLL_PIXELS_PER_SECOND }}
            onAnimationEnd={() => setFeedback((old) => old.filter((entry) => entry.id !== item.id))}>{item.label}</span>)}
          {events.filter((event) => !event.rest).map((event) => <div key={`head-${event.index}`}
            className={`cheese-head ${marks[event.attackIndex!] ?? ''} ${holdingIndex === event.attackIndex && elapsed >= event.seconds - HIT_WINDOW_SECONDS ? 'being-eaten' : ''}`}
            style={{ left: event.seconds * SCROLL_PIXELS_PER_SECOND }}>
            <Cheese duration={event.duration} className="cheese-piece" />
          </div>)}
        </div>
        <Rat holding={holdingIndex !== null} eating={eating} stumble={stumble} pulse={bitePulse} />
        

      </div>

      <div className="play-footer">
        <span className="attempt-indicator">BITE {challenge.attempt} / {ATTEMPTS_PER_LEVEL}</span>
        {phase === 'ready' ? <button className="start-button" onClick={() => void begin()}>LET’S EAT <span>→</span></button> : phase === 'countin' ? <span className="input-cue">Listen…</span> : phase === 'playing' ? <span className="input-cue"><span className="desktop-hint">Space to eat{hasHolds ? ' · hold for ties' : ''}</span><span className="touch-hint">Tap to eat{hasHolds ? ' · hold for ties' : ''}</span></span> : <button className="start-button" onClick={advance}>NEXT LEVEL <span>→</span></button>}
      </div>


      {phase === 'countin' && <div className="countin-overlay"><div className="count-number">{countdown || 'GO!'}</div><span>COUNT IN</span></div>}

    </section>
    <CheeseBoard />

  </main>
}
