import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import * as Tone from 'tone'
import { Cheese } from './Cheese'
import FinishHole from './FinishHole'
import CheeseBoard from './CheeseBoard'
import WorldScenery from './WorldScenery'
import { BITE_SOUND_GROUPS } from './biteAudio'
import { createRunAudio, type BiteSound } from './audio'
import { type MusicIcon, type MusicInstruments } from './musicInstruments'
import { GROOVE_LAYERS, unlockedLayerCount } from './groove'
import { RhythmNotation, type Judgement } from './RhythmNotation'
import { ATTEMPTS_PER_LEVEL, createEvents, createOnsets, levelSeconds, nextChallenge, SCROLL_PIXELS_PER_SECOND, type Onset, type Duration } from './level'
import { LEVELS } from './levels'
import { HIT_WINDOW_SECONDS, judgeTap, judgeRelease, type TapJudgement } from './timing'

type Phase = 'ready' | 'countin' | 'playing' | 'finished'
type Counts = { perfect: number; good: number; miss: number; extra: number; longest: number }
const EMPTY: Counts = { perfect: 0, good: 0, miss: 0, extra: 0, longest: 0 }

function Rat({ eating, holding, stumble, pulse, bite }: { eating: boolean; holding: boolean; stumble: boolean; pulse: number; bite: { duration: Duration; variant: number } }) {
  return <div className={`rat bite-variant-${bite.variant} ${eating ? 'eating' : ''} ${holding ? 'holding' : ''} ${stumble ? 'stumble' : ''}`} key={pulse}>
    <svg viewBox="0 0 32 20" shapeRendering="crispEdges" role="img" aria-label="Tiny pixel rat">
      <path fill="#d79391" d="M1 14h2v2h7v-2H4v-2H1z" />
      <path fill="#777c80" d="M8 9h3V7h9V5h6v3h2v2h2v2h2v3h-5v2H11v-2H8z" />
      <path fill="#9da2a4" d="M11 9h10V7h4v4h3v3H11z" />
      <path fill="#777c80" d="M20 3h5v6h-5z" />
      <path fill="#dca5a0" d="M21 4h3v3h-3z" />
      <path fill="#242d2c" d="M27 9h2v2h-2z" />
      <path fill="#dfaaa2" d="M31 12h1v2h-1z" />
      <path className="rat-mouth" fill="#493632" d="M27 14h5v3h-5z" />
      <path className="rat-tooth" fill="#fff5d9" d="M29 14h2v2h-2z" />
      <path className="rat-jaw" fill="#dca5a0" d="M28 15h4v1h-4z" />
      <path className="rat-foot rat-foot-back" fill="#d79391" d="M12 17h4v2h-4z" />
      <path className="rat-foot rat-foot-front" fill="#d79391" d="M24 17h4v2h-4z" />
    </svg>
    {eating && <>
      <span className="bite-morsel" aria-hidden="true"><Cheese duration={bite.duration} className="cheese-piece" /></span>
      <span className="cheese-crumbs" aria-hidden="true"><i/><i/><i/><i/><i/></span>
    </>}
  </div>
}

// Tiny grid-aligned sprites keep the HUD in the same pixel style as the rat.
function InstrumentIcon({ id }: { id: MusicIcon }) {
  const sprites: Record<MusicIcon, React.ReactNode> = {
    kick: <><path fill="#657666" d="M6 4h12v2h3v3h2v12h-2v3h-3v2H6v-2H3v-3H1V9h2V6h3z" /><path fill="#e7c78b" d="M7 7h10v2h3v12h-3v2H7v-2H4V9h3z" /><path fill="#faf0cd" d="M8 9h8v2h2v8h-2v2H8v-2H6v-8h2z" /><path fill="#657666" d="M11 17h3v10h5v2h-8z" /></>,
    snare: <><path fill="#657666" d="M3 10h22v14H3zM1 12h2v10H1zm24 0h2v10h-2zM6 24h3v5H6zm15 0h3v5h-3z" /><path fill="#d79391" d="M5 14h18v6H5z" /><path fill="#f4ead2" d="M5 10h18v3H5zM5 21h18v2H5z" /><path fill="#ae8860" d="M2 3h3v2h3v2h3v2H8V7H5V5H2zm21 0h3v2h-3v2h-3v2h-3V7h3V5h3z" /></>,
    shaker: <><path fill="#657666" d="M8 2h12v2h3v3h2v17h-2v3h-3v2H8v-2H5v-3H3V7h2V4h3z" /><path fill="#c39565" d="M9 5h10v2h3v16h-3v3H9v-3H6V7h3z" /><path fill="#f0d294" d="M6 12h16v6H6z" /><path fill="#8a674b" d="M9 8h2v2H9zm8 13h2v2h-2zM9 21h2v2H9zm8-13h2v2h-2z" /></>,
    hats: <><path fill="#657666" d="M13 6h2v20h-2zM10 25h8v2h3v2h-3v-2h-8v2H7v-2h3z" /><path fill="#c3a568" d="M4 9h20v2h4v3H0v-3h4zM3 16h22v2H3z" /><path fill="#f0d899" d="M6 8h16v3H6zM2 12h24v1H2z" /></>,
    synthBass: <><path fill="#465848" d="M2 8h24v18H2z" /><path fill="#859e78" d="M4 10h20v6H4z" /><path fill="#e6c58a" d="M6 11h5v3H6z" /><path fill="#d79391" d="M16 11h3v3h-3z" /><path fill="#f5edd8" d="M4 18h20v6H4z" /><path fill="#465848" d="M7 18h2v4H7zm5 0h2v4h-2zm6 0h2v4h-2z" /></>,
    doubleBass: <><path fill="#657666" d="M12 0h5v7h-1v5h3v3h3v5h-2v3h3v5h-3v2H9v-2H6v-5h3v-3H7v-5h3v-3h3V7h-1zM13 29h3v3h-3z" /><path fill="#b47e51" d="M11 14h7v3h2v2h-3v5h4v3h-3v2h-7v-2H8v-3h4v-5H9v-2h2z" /><path fill="#e3bb7b" d="M13 4h2v21h-2zM11 25h7v2h-7z" /><path fill="#5d4935" d="M10 20h1v3h-1zm8 0h1v3h-1z" /></>,
    bass: <><path fill="#657666" d="M12 1h6v7h-1v9h3v-3h3v4h2v10h-3v3H6v-3H3V18h2v-4h3v3h4V8h-1V1z" /><path fill="#c18c60" d="M6 19h4v2h9v-2h3v8h-3v2H9v-2H6z" /><path fill="#e6c58a" d="M13 7h3v16h-3zM12 2h5v4h-5z" /><path fill="#f2dca5" d="M7 22h4v5H7z" /><path fill="#465848" d="M12 21h6v2h-6zm0 5h6v2h-6zM10 2h2v2h-2zm7 2h3v2h-3z" /></>,
    synth: <><path fill="#657666" d="M1 7h26v19H1z" /><path fill="#93ad8b" d="M3 9h22v7H3z" /><path fill="#edcb84" d="M5 11h7v3H5z" /><path fill="#d79391" d="M16 11h3v3h-3zm5 0h2v3h-2z" /><path fill="#f5edd8" d="M3 18h22v6H3z" /><path fill="#657666" d="M6 18h2v4H6zm5 0h2v4h-2zm7 0h2v4h-2zm5 0h2v4h-2z" /></>,
    guitar: <><path fill="#657666" d="M12 1h6v7h-1v9h3v-3h3v4h2v10h-3v3H6v-3H3V18h2v-4h3v3h4V8h-1z" /><path fill="#d9ac70" d="M6 19h4v2h9v-2h3v8h-3v2H9v-2H6zM13 3h3v20h-3z" /><path fill="#69543e" d="M12 21h6v4h-6zM12 27h6v2h-6z" /></>,
    flute: <><path fill="#657666" d="M1 13h26v6H1zM3 11h4v2H3z" /><path fill="#d8e0cb" d="M2 14h24v3H2z" /><path fill="#778c76" d="M9 13h2v2H9zm5 0h2v2h-2zm5 0h2v2h-2z" /><path fill="#b5c4a7" d="M3 18h3v3H3zm18 0h3v3h-3z" /></>,
    trumpet: <><path fill="#b69b58" d="M1 13h17v-3h3V7h5v17h-5v-3h-3v-3H8v5h8v-4h3v7H5V16H1z" /><path fill="#efd58c" d="M3 14h18v3H3zM22 9h3v13h-3zM8 10h3v4H8zm5 0h3v4h-3zM7 23h9v2H7z" /></>,
    piano: <><path fill="#657666" d="M2 5h24v22H2zM5 27h3v4H5zm15 0h3v4h-3z" /><path fill="#ab8260" d="M4 7h20v9H4z" /><path fill="#f5edd8" d="M4 18h20v6H4z" /><path fill="#465848" d="M7 18h2v4H7zm5 0h2v4h-2zm6 0h2v4h-2z" /></>,
    pad: <><path fill="#657666" d="M2 3h24v25H2z" /><path fill="#b2a5c8" d="M5 6h8v8H5zm11 0h7v8h-7zM5 17h8v8H5z" /><path fill="#d79391" d="M16 17h7v8h-7z" /><path fill="#e8deef" d="M6 7h5v2H6zm11 0h4v2h-4zM6 18h5v2H6zm11 0h4v2h-4z" /></>,
  }
  return <svg viewBox="0 0 28 32" shapeRendering="crispEdges" aria-hidden="true">{sprites[id]}</svg>
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
  // Half a sixteenth separates the visual barline from the next downbeat.
  const barlineInsetPixels = beatSeconds / 8 * SCROLL_PIXELS_PER_SECOND
  const [scenerySeed, setScenerySeed] = useState(() => Math.floor(Math.random() * 0xffffffff))
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
  const streakRef = useRef(0)
  const completedBars = useRef(0)
  const [musicStyle, setMusicStyle] = useState('')
  const [musicInstruments, setMusicInstruments] = useState<MusicInstruments | null>(null)
  const [barStreak, setBarStreak] = useState(0)
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
    setScenerySeed(Math.floor(Math.random() * 0xffffffff))
    completedBars.current = 0; setBarStreak(0)
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
    synthRef.current?.continueMusic()
    setPhase('finished'); setElapsed(totalSeconds)
    activeHold.current = null; setHoldingIndex(null); setEating(false)
    window.clearTimeout(biteTimer.current)
    if (animFrame.current) cancelAnimationFrame(animFrame.current)
  }, [challenge, onsets.length, prepare, totalSeconds])

  const begin = useCallback(async () => {
    const generation = ++runGeneration.current
    await Tone.start()
    if (generation !== runGeneration.current) return
    Tone.Transport.stop()
    Tone.Transport.cancel()
    Tone.Transport.position = 0
    setScenerySeed(Math.floor(Math.random() * 0xffffffff))
    completedBars.current = 0; setBarStreak(0)
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
    const variant = (bite.variant + 1 + Math.floor(Math.random() * 2)) % 3
    setBite({ duration: candidate.duration, variant })
    synthRef.current?.munch(variant)
    setBitePulse((p) => p + 1); setEating(true)
    window.clearTimeout(biteTimer.current)
    if (!candidate.holdSeconds) biteTimer.current = window.setTimeout(() => setEating(false), 260)
  }, [phase, begin, advance, onsets, setMark, updateCount, showFeedback, finish, bite.variant])

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
      <a className="brand" href="#" onClick={(e) => e.preventDefault()}><img className="brand-mark" src="/rhythm-rat.svg" alt="" width="32" height="32" /><span>RHYTHM<span className="brand-light">RAT</span></span></a>
      <div className="sound-controls"><label htmlFor="bite-sound">Bite sound</label><select id="bite-sound" value={sound} onChange={(event) => setSound(event.target.value as BiteSound)}>
        {BITE_SOUND_GROUPS.map(({ label, options }) => <optgroup key={label} label={label}>
          {options.map(({ id, label: name }) => <option key={id} value={id}>{name}</option>)}
        </optgroup>)}
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
    </section>

    <section className="game-card">
      <div className="game-heading"><div className="game-status"><span className="live-dot" /> {phase === 'finished' ? 'Complete' : phase === 'countin' ? 'Count in' : level.title}</div><div className="bpm"><strong className="time-signature" aria-label="4/4 time">4/4</strong><strong>{level.bpm}</strong><small>BPM</small><span className="divider" /><small>BAR {Math.min(level.bars.length, Math.max(1, Math.floor(elapsed / (level.beatsPerBar * beatSeconds)) + 1))} / {level.bars.length}</small></div></div>

      <div className={`runner-lane ${stumble ? 'lane-stumble' : ''} ${phase === 'finished' ? 'level-won' : ''}`}
        onPointerDown={(event) => {
          if (event.button !== 0 || pointerId.current !== null) return
          event.preventDefault(); pointerId.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId); press()
        }}
        onPointerUp={(event) => { if (pointerId.current === event.pointerId) { pointerId.current = null; release() } }}
        onPointerCancel={(event) => { if (pointerId.current === event.pointerId) { pointerId.current = null; if (activeHold.current) { updateCount('miss'); finish() } } }}
        onLostPointerCapture={(event) => { if (pointerId.current === event.pointerId) { pointerId.current = null; if (activeHold.current) { updateCount('miss'); finish() } } }}>
        <div className="instrument-hud" role="status" aria-live="polite" aria-label={musicStyle ? `${musicStyle} · active music layers` : 'Active music layers'} title={musicStyle}>
          {GROOVE_LAYERS.filter(({ entryBar }) => barStreak >= entryBar - 1).map(({ id, name }) => {
            const chosen = id === 'synth' ? musicInstruments?.lead : id === 'pad' ? musicInstruments?.chords : id === 'bass' ? musicInstruments?.bass : id === 'hats' ? musicInstruments?.timekeeper : null
            const icon = chosen?.icon ?? id
            const label = chosen?.name ?? name
            return <span className="instrument-life" key={id} title={label}>
              <InstrumentIcon id={icon} /><span className="sr-only">{label} added. </span>
            </span>
          })}
        </div>
        <WorldScenery seed={scenerySeed} elapsed={elapsed} running={phase === 'playing' || phase === 'countin'} />
        {notice && <div key={notice + challenge.attempt + challenge.levelIndex} className="run-notice" onAnimationEnd={() => setNotice('')}>{notice}</div>}
        {phase === 'ready' && <div className="ready-cue"><kbd className="keycap"><span className="desktop-hint">SPACE</span><span className="touch-hint">TAP</span></kbd><span>to start</span></div>}
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
        <div className="cheese-track" aria-hidden="true" style={{ transform: `translateX(${-elapsed * SCROLL_PIXELS_PER_SECOND}px)` }}>
          <RhythmNotation marks={marks} level={level} />
          {Array.from({ length: level.bars.length * level.beatsPerBar * 4 }, (_, step) => {
            const subdivision = step % 4
            const label = subdivision === 0 ? String(Math.floor(step / 4) % level.beatsPerBar + 1) : ['e', '+', 'a'][subdivision - 1]
            return <span key={`count-${step}`} className={`rhythm-count ${subdivision === 0 ? 'rhythm-count-beat' : ''}`}
              style={{ left: step * beatSeconds / 4 * SCROLL_PIXELS_PER_SECOND }}>{label}</span>
          })}
          {Array.from({ length: level.bars.length + 1 }, (_, index) => <span
            key={`bar-${index}`} className={`cheese-barline ${phase !== 'ready' && elapsed * SCROLL_PIXELS_PER_SECOND >= index * level.beatsPerBar * beatSeconds * SCROLL_PIXELS_PER_SECOND - barlineInsetPixels ? 'passed' : 'upcoming'} ${phase !== 'ready' && elapsed >= index * level.beatsPerBar * beatSeconds ? 'is-lit' : ''}`}
            style={{ left: index * level.beatsPerBar * 60 / level.bpm * SCROLL_PIXELS_PER_SECOND - barlineInsetPixels }}
          >
            <svg className="bar-streetlamp" viewBox="0 0 56 150" shapeRendering="crispEdges">
              <path fill="currentColor" d="M27 150V42H17v-3h22v3H29v108zM18 36v-3h20v3zM23 30v-5h10v5zM20 44h16l-3 13H23z" />
              <g className="streetlamp-light">
                <ellipse className="streetlamp-halo" cx="28" cy="49" rx="23" ry="22" />
                <path d="M23 45h10l-2 9h-6z" />
              </g>
              {index < level.bars.length && <>
                <path fill="#f0dfaa" d="M21 44h14v12H21z" />
                <text className="lamp-bar-number" x="28" y="50" textAnchor="middle" dominantBaseline="central">{level.bars.length - index}</text>
              </>}
            </svg>
          </span>)}
          {onsets.map((onset) => <div key={onset.index} className={`rhythm-cheese ${marks[onset.index] ?? ''} ${holdingIndex === onset.index ? 'being-eaten' : ''}`} style={{ left: onset.seconds * SCROLL_PIXELS_PER_SECOND }}>
            {onset.holdSeconds > 0 && <span className="cheese-strip" style={{ width: onset.holdSeconds * SCROLL_PIXELS_PER_SECOND, clipPath: `inset(0 0 0 ${holdingIndex === onset.index ? Math.max(0, Math.min(100, (elapsed - onset.seconds) / onset.holdSeconds * 100)) : 0}%)` }} />}

          </div>)}
          <FinishHole tier={challenge.levelIndex} celebrating={phase === 'finished'} perfect={phase === 'finished' && countsRef.current.perfect === onsets.length} seed={scenerySeed} left={totalSeconds * SCROLL_PIXELS_PER_SECOND} />
          {feedback.map((item) => <span key={item.id} className={`note-feedback ${item.tone}`}
            style={{ left: item.seconds * SCROLL_PIXELS_PER_SECOND }}
            onAnimationEnd={() => setFeedback((old) => old.filter((entry) => entry.id !== item.id))}>{item.label}</span>)}
          {events.filter((event) => !event.rest).map((event) => <div key={`head-${event.index}`}
            className={`cheese-head ${marks[event.attackIndex!] ?? ''} ${holdingIndex === event.attackIndex && elapsed >= event.seconds - HIT_WINDOW_SECONDS ? 'being-eaten' : ''}`}
            style={{ left: event.seconds * SCROLL_PIXELS_PER_SECOND }}>
            <Cheese duration={event.duration} className="cheese-piece" />
          </div>)}
        </div>
        <Rat holding={holdingIndex !== null} eating={eating} stumble={stumble} pulse={bitePulse} bite={bite} />
        

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
