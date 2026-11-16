import { HeaderControls } from './profile/PageLayout'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Cheese } from './Cheese'
import FinishHole from './FinishHole'
import CheeseBoard from './CheeseBoard'
import WorldScenery from './WorldScenery'
import { BITE_SOUND_GROUPS } from './biteAudio'
import { type BiteSound } from './audio'
import { type MusicIcon } from './musicInstruments'
import { GROOVE_LAYERS } from './groove'
import { RhythmNotation } from './RhythmNotation'
import { ATTEMPTS_PER_LEVEL, noteSpec, SCROLL_PIXELS_PER_SECOND, type Duration, type Level } from './level'
import { LEVELS } from './levels'
import OnlineRatings from './ratings/OnlineRatings'
import LoginDialog from './ratings/LoginDialog'
import { useOnlineRatings } from './ratings/useOnlineRatings'
import CountInPreview from './gameplay/CountInPreview'
import RatEntrance from './gameplay/RatEntrance'
import TapZone from './gameplay/TapZone'
import SilentModeReminder from './gameplay/SilentModeReminder'
import { useGameRun } from './gameplay/useGameRun'
import { HIT_WINDOW_SECONDS } from './timing'

type NoteTypeFilters = { crotchets: boolean; quavers: boolean; minims: boolean; rests: boolean; dotted: boolean; ties: boolean }
const ALL_NOTE_TYPES: NoteTypeFilters = { crotchets: true, quavers: true, minims: true, rests: true, dotted: true, ties: true }

function levelMatchesNoteTypes(level: Level, filters: NoteTypeFilters) {
  return level.bars.flat().every((token) => {
    const note = noteSpec(token)
    return (filters.crotchets || note.duration !== 'q')
      && (filters.quavers || note.duration !== '8')
      && (filters.minims || note.duration !== 'h')
      && (filters.rests || !note.rest)
      && (filters.dotted || !note.dotted)
      && (filters.ties || !note.tie)
  })
}

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

function Mousetrap() {
  return <svg className="loss-trap" viewBox="0 0 96 56" shapeRendering="crispEdges" role="img" aria-label="Pixel art mousetrap with a fallen rat and a piece of cheese">
    <path fill="#541e2b" d="M8 47h80v5H8z" />
    <path fill="#9c553c" d="M8 30h80v16H8z" />
    <path fill="#d59a62" d="M8 30h80v11H8z" />
    <path fill="#edbe80" d="M12 32h72v3H12z" />
    <path fill="#b57649" d="M14 38h14v2H14zm52 0h14v2H66z" />
    <path fill="#f2c75d" d="M64 24h14v9H60v-5h4z" />
    <path fill="#ffe59a" d="M64 24h14l-7-7z" />
    <path fill="#bd7d38" d="M65 28h3v3h-3zm9-2h2v2h-2z" />
    <path fill="#d58b99" d="M15 30h9v-4H12v-5H8v8h7z" />
    <path fill="#777582" d="M23 22h6v-4h19v3h8v5h7v7H23z" />
    <path fill="#b7aab4" d="M27 22h20v2h8v6H27z" />
    <path fill="#777582" d="M43 15h8v10h-8z" />
    <path fill="#e1a5ae" d="M45 17h4v5h-4zM61 27h4v3h-4zM29 32h6v3h-6zm19 0h6v3h-6z" />
    <path fill="#392c3c" d="M54 24h2v2h2v2h-2v-2h-2zm4 0h2v2h-2zm-4 4h2v2h-2z" />
    <path fill="#635d69" d="M36 8h4v28h-4zM36 8h44v4H36zm40 4h4v24h-4zM36 34h44v4H36z" />
    <path fill="#e3d7d9" d="M37 8h2v26h-2zm2 0h39v2H39zm38 2h2v24h-2zM40 34h36v2H40z" />
    <path fill="#837d88" d="M35 33h7v7h-7zm8 0h3v7h-3zm4 0h3v7h-3z" />
    <path fill="#f2a0a3" d="M22 6h3v6h-3zm-8 8h6v3h-6zm15-9h3v5h-3z" />
  </svg>
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
  const lab = useOnlineRatings(LEVELS)
  const [loginOpen, setLoginOpen] = useState(false)
  const rated = !!lab.user
  const [noteTypeFilters, setNoteTypeFilters] = useState(ALL_NOTE_TYPES)
  const [noteTypeFilterMessage, setNoteTypeFilterMessage] = useState('')
  const matchingLevels = useMemo(() => LEVELS.filter((candidate) => levelMatchesNoteTypes(candidate, noteTypeFilters)), [noteTypeFilters])
  const eligibleLevels = matchingLevels
  const {
    challenge, level, events, onsets, hasHolds, totalSeconds, beatSeconds, countInSeconds, barlineInsetPixels,
    scenerySeed, phase, elapsed, countdown, muted, setMuted, sound, setSound, marks, feedback, dismissFeedback,
    notice, setNotice, allNotesCleared, bitePulse, bite, eating, stumble, holdingIndex, barStreak, musicStyle,
    musicInstruments, perfect, begin, prepare, selectLevel, press, release, cancelActiveHold,
  } = useGameRun(lab, eligibleLevels, loginOpen)
  const anotherLevelButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (phase === 'lost') anotherLevelButton.current?.focus({ preventScroll: true })
  }, [phase])

  const levelProgress = Math.max(0, Math.min(1, elapsed / totalSeconds))

  return <>
    <HeaderControls>
      <div className="sound-controls"><label htmlFor="bite-sound">Bite sound</label><select id="bite-sound" value={sound} onChange={(event) => setSound(event.target.value as BiteSound)}>
        {BITE_SOUND_GROUPS.map(({ label, options }) => <optgroup key={label} label={label}>
          {options.map(({ id, label: name }) => <option key={id} value={id}>{name}</option>)}
        </optgroup>)}
      </select>
      <button className="sound-toggle" onClick={() => setMuted((v) => !v)} aria-label={muted ? 'Unmute sound' : 'Mute sound'}><span>{muted ? '◌' : '♫'}</span> {muted ? 'SOUND OFF' : 'SOUND ON'}</button></div>
    </HeaderControls>
    <SilentModeReminder />

    {!lab.user && !lab.loading && <div className="login-progress-prompt">
      <span>Log in to track progress.</span>
      <button type="button" className="account-button" disabled={phase === 'countin' || phase === 'playing'} onClick={() => setLoginOpen(true)}>Log in</button>
    </div>}
    {lab.loading && <p className="account-note" role="status">Checking account…</p>}

    {loginOpen && <LoginDialog onCancel={() => setLoginOpen(false)} onLogin={async user => {
      await lab.acceptUser(user)
      setLoginOpen(false)
    }} />}
    {!lab.user && lab.error && <p role="alert">{lab.error} Unrated play is still available.</p>}

    <section className="game-card">
      <div className="game-heading"><div className="game-heading-info"><div className="game-status"><span className="live-dot" /> {phase === 'lost' ? 'Caught!' : phase === 'finished' ? 'Complete' : phase === 'countin' ? 'Count in' : level.title}</div>
        <span className="attempt-indicator">{rated ? challenge.attempt === 1 ? 'RATED' : 'RATED · DRAW CHANCE' : 'UNRATED'} · BITE {challenge.attempt} / {ATTEMPTS_PER_LEVEL}</span>
        {lab.user && phase !== 'lost' && <OnlineRatings snapshot={lab.snapshot} error={lab.error} saveStatus={lab.saveStatus} delta={lab.delta} onRetry={() => void lab.retry()} />}
      </div><div className="bpm"><strong className="time-signature" aria-label="4/4 time">4/4</strong><strong>{level.bpm}</strong><small>BPM</small><span className="divider" /><small>BAR {Math.min(level.bars.length, Math.max(1, Math.floor(elapsed / (level.beatsPerBar * beatSeconds)) + 1))} / {level.bars.length}</small></div></div>

      <div className={`runner-lane ${stumble ? 'lane-stumble' : ''} ${phase === 'finished' ? 'level-won' : ''}`}>
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
        <WorldScenery levelIndex={challenge.levelIndex} levelCount={LEVELS.length} seed={scenerySeed} elapsed={elapsed} running={phase === 'playing' || phase === 'countin'} />
        {notice && <div key={notice + challenge.attempt + challenge.levelIndex} className="run-notice" onAnimationEnd={() => setNotice('')}>{notice}</div>}
        {phase === 'ready' && <button type="button" className="ready-cue" aria-label="Start level" onClick={() => void begin()}><kbd className="keycap"><span className="desktop-hint">SPACE</span><span className="touch-hint">TAP</span></kbd><span>to start</span></button>}
        {phase === 'ready' || phase === 'countin' ? (
          <CountInPreview level={level} countdown={phase === 'countin' ? countdown : undefined} />
        ) : (
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
        )}
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
          <FinishHole tier={challenge.levelIndex} celebrating={phase === 'finished'} perfect={phase === 'finished' && perfect} seed={scenerySeed} left={totalSeconds * SCROLL_PIXELS_PER_SECOND} />
          {feedback.map((item) => <span key={item.id} className={`note-feedback ${item.tone}`}
            style={{ left: item.seconds * SCROLL_PIXELS_PER_SECOND }}
            onAnimationEnd={() => dismissFeedback(item.id)}>{item.label}</span>)}
          {events.filter((event) => !event.rest).map((event) => <div key={`head-${event.index}`}
            className={`cheese-head ${marks[event.attackIndex!] ?? ''} ${holdingIndex === event.attackIndex && elapsed >= event.seconds - HIT_WINDOW_SECONDS ? 'being-eaten' : ''}`}
            style={{ left: event.seconds * SCROLL_PIXELS_PER_SECOND }}>
            <Cheese duration={event.duration} className="cheese-piece" />
          </div>)}
        </div>
        <RatEntrance entering={phase === 'countin'} progress={(elapsed + countInSeconds) / countInSeconds}>
          <Rat holding={holdingIndex !== null} eating={eating} stumble={stumble} pulse={bitePulse} bite={bite} />
        </RatEntrance>
        

      </div>

      <div className="play-footer">
        <TapZone phase={phase} cleared={allNotesCleared} hasHolds={hasHolds} resetKey={`${challenge.levelIndex}:${challenge.attempt}`}
          onPress={press} onRelease={release} onCancel={cancelActiveHold} />
      </div>


      {phase === 'lost' && <section className="loss-overlay" aria-labelledby="loss-title">
        <div className="loss-card">
          <span className="loss-eyebrow">END OF THE RAT RUN</span>
          <Mousetrap />
          <h2 id="loss-title">Oh, snap.</h2>
          <p>The trap got you. There’s more cheese out there.</p>
          {lab.user && <OnlineRatings snapshot={lab.snapshot} error={lab.error} saveStatus={lab.saveStatus} delta={lab.delta} onRetry={() => void lab.retry()} />}
          <div className="loss-next"><span>NEXT NIBBLE</span><strong>{level.title}</strong></div>
          <button ref={anotherLevelButton} className="loss-button" onClick={(event) => {
            event.currentTarget.blur()
            void begin()
          }}>ANOTHER LEVEL <span aria-hidden="true">→</span></button>
        </div>
      </section>}


    </section>
    <div className="admin-toolbar">
      <div className="note-type-filters" role="group" aria-label="Filter levels by note types">
        <span>INCLUDE NOTE TYPES</span>
        {([
          ['crotchets', 'Crotchets'], ['quavers', 'Quavers'], ['minims', 'Minims'], ['rests', 'Rests'], ['dotted', 'Dotted notes'], ['ties', 'Tied notes'],
        ] as const).map(([key, label]) => <label key={key}>
          <input type="checkbox" checked={noteTypeFilters[key]} disabled={phase === 'countin' || phase === 'playing'} onChange={() => {
            const nextFilters = { ...noteTypeFilters, [key]: !noteTypeFilters[key] }
            const matching = LEVELS.filter((candidate) => levelMatchesNoteTypes(candidate, nextFilters))
            if (!matching.length) {
              setNoteTypeFilterMessage('No levels match that combination. Keep at least one supported note type selected.')
              return
            }
            setNoteTypeFilterMessage('')
            setNoteTypeFilters(nextFilters)
            if (!levelMatchesNoteTypes(level, nextFilters)) {
              if (rated) {
                lab.abandon()
                prepare({ levelIndex: lab.recommend(undefined, matching), attempt: 1 })
              } else {
                const currentPoolIndex = eligibleLevels.findIndex((candidate) => candidate.id === level.id)
                const nextLevel = matching[Math.min(Math.max(currentPoolIndex, 0), matching.length - 1)]
                selectLevel(LEVELS.indexOf(nextLevel))
              }
            }
          }} />{label}
        </label>)}
        <small>{noteTypeFilterMessage || `${matchingLevels.length} matching levels`}</small>
      </div>
      {!rated && <>
        <label htmlFor="admin-level">LEVEL</label>
        <select id="admin-level" value={challenge.levelIndex} onChange={(event) => {
          selectLevel(Number(event.target.value))
          event.currentTarget.blur()
        }}>
          {eligibleLevels.map((item) => <option key={item.id} value={LEVELS.indexOf(item)}>{LEVELS.indexOf(item) + 1}. {item.title}</option>)}
        </select>
      </>}
    </div>
    <CheeseBoard />

  </>
}
