import * as Tone from 'tone'
import { GROOVE_LAYERS, hitsAtStep, type GrooveHit, type LayerId, type SelectedPattern } from './groove'

import { type LeadInstrument, type ChordInstrument, type BassInstrument, type TimekeeperInstrument } from './musicInstruments'

import { chooseStyleArrangement } from './musicStyles'
import { createGrooveClock } from './grooveClock'

type Instrument = {
  play: (hit: GrooveHit, time: number, stepSeconds: number) => void
  dispose: () => void
}

function createNoise(output: Tone.Gain, cutoff: number, volume: number, decay: number): Instrument {
  const filter = new Tone.Filter(cutoff, 'highpass').connect(output)
  const voice = new Tone.NoiseSynth({ volume, noise: { type: 'white' },
    envelope: { attack: 0.001, decay, sustain: 0, release: 0.02 } }).connect(filter)
  return {
    play: (hit, time) => voice.triggerAttackRelease(decay, time, hit.velocity ?? 0.65),
    dispose() { voice.dispose(); filter.dispose() },
  }
}

function createPitched(output: Tone.Gain, pattern: SelectedPattern, volume: number): Instrument {
  const settings = pattern.voice!
  const filter = new Tone.Filter({ frequency: settings.cutoff, type: 'lowpass', Q: 1 }).connect(output)
  const voice = new Tone.Synth({ volume, oscillator: { type: settings.oscillator },
    envelope: { attack: settings.attack, decay: settings.decay, sustain: settings.sustain, release: settings.release } }).connect(filter)
  return {
    play: (hit, time, stepSeconds) => voice.triggerAttackRelease(hit.notes![0], stepSeconds * (hit.durationSteps ?? 1), time, hit.velocity ?? .65),
    dispose() { voice.dispose(); filter.dispose() },
  }
}

function createKick(output: Tone.Gain): Instrument {
  const voice = new Tone.MembraneSynth({ volume: -15, pitchDecay: 0.025, octaves: 5,
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 } }).connect(output)
  return {
    play: (hit, time) => voice.triggerAttackRelease('C1', 0.12, time, hit.velocity ?? 0.8),
    dispose: () => voice.dispose(),
  }
}

function createBass(output: Tone.Gain, pattern: SelectedPattern, instrument: BassInstrument): Instrument {
  if (instrument.id === 'synth') return createPitched(output, pattern, -25)
  const upright = instrument.id === 'doubleBass'
  const filter = new Tone.Filter(upright ? 1100 : 2800, 'lowpass').connect(output)
  // Upright has a woody attack and softer body; electric has a brighter pluck.
  const voice = new Tone.FMSynth({ volume: upright ? -16 : -24,
    harmonicity: upright ? 1 : 2, modulationIndex: upright ? .65 : 1.6,
    oscillator: { type: upright ? 'triangle' : 'sine' },
    envelope: { attack: upright ? .009 : .002, decay: upright ? .45 : .3, sustain: .12, release: upright ? .12 : .06 },
    modulationEnvelope: { attack: .001, decay: upright ? .045 : .1, sustain: 0, release: .03 },
  }).connect(filter)
  return {
    play: (hit, time, stepSeconds) => voice.triggerAttackRelease(hit.notes![0], (hit.durationSteps ?? 1) * stepSeconds, time, hit.velocity ?? .65),
    dispose() { voice.dispose(); filter.dispose() },
  }
}

function createLead(output: Tone.Gain, pattern: SelectedPattern, instrument: LeadInstrument): Instrument {
  if (instrument.id === 'synth') return createPitched(output, pattern, -28)
  if (instrument.id === 'guitar') {
    const voice = new Tone.PluckSynth({ volume: -23, attackNoise: 1, dampening: 2800, resonance: .85 }).connect(output)
    return {
      play: (hit, time, stepSeconds) => voice.triggerAttackRelease(hit.notes![0], (hit.durationSteps ?? 1) * stepSeconds, time, hit.velocity ?? .6),
      dispose: () => voice.dispose(),
    }
  }
  const flute = instrument.id === 'flute'
  return createPitched(output, { ...pattern, voice: {
    oscillator: flute ? 'sine' : 'sawtooth', cutoff: flute ? 3200 : 1800,
    attack: flute ? .025 : .018, decay: .12, sustain: flute ? .65 : .55, release: .07,
  } }, flute ? -24 : -30)
}

function createChords(output: Tone.Gain, pattern: SelectedPattern, instrument: ChordInstrument): Instrument {
  const preset = pattern.voice!
  const filter = new Tone.Filter(instrument.id === 'pad' ? preset.cutoff : 2400, 'lowpass').connect(output)
  // Sustained chords sit behind the lead; piano/guitar use plucked envelopes.
  const voice = instrument.id === 'piano'
    ? new Tone.PolySynth(Tone.FMSynth, { volume: -28, harmonicity: 2, modulationIndex: .6,
      envelope: { attack: .002, decay: .7, sustain: .05, release: .15 },
      modulationEnvelope: { attack: .001, decay: .2, sustain: 0, release: .1 } }).connect(filter)
    : new Tone.PolySynth(Tone.Synth, { volume: instrument.id === 'pad' ? -38 : -28,
      oscillator: { type: instrument.id === 'pad' ? preset.oscillator : 'triangle' },
      envelope: instrument.id === 'pad'
        ? { attack: preset.attack, decay: preset.decay, sustain: preset.sustain, release: preset.release }
        : { attack: .002, decay: .35, sustain: .03, release: .09 },
    }).connect(filter)
  return {
    play(hit, time, stepSeconds) {
      const duration = (hit.durationSteps ?? 1) * stepSeconds
      if (instrument.id === 'guitar') {
        // A tiny strum spreads the chord instead of firing all strings together.
        hit.notes!.forEach((note, index) => voice.triggerAttackRelease(note, Math.max(.01, duration - index * .008), time + index * .008, hit.velocity ?? .6))
      } else voice.triggerAttackRelease(hit.notes!, duration, time, hit.velocity ?? .6)
    },
    dispose() { voice.dispose(); filter.dispose() },
  }
}

function createHats(output: Tone.Gain): Instrument {
  const closed = createNoise(output, 7000, -29, .025)
  const open = createNoise(output, 6500, -31, .18)
  return {
    play: (hit, time, stepSeconds) => (hit.articulation === 'open' ? open : closed).play(hit, time, stepSeconds),
    dispose() { closed.dispose(); open.dispose() },
  }
}

// Timekeeper timbre is independent of the shared hat/shaker pattern bank.
function createTimekeeper(output: Tone.Gain, instrument: TimekeeperInstrument): Instrument {
  if (instrument.id === 'hiHat') return createHats(output)
  const filter = new Tone.Filter({ type: 'bandpass', frequency: 4200, Q: .6 }).connect(output)
  const voice = new Tone.NoiseSynth({ volume: -25, noise: { type: 'pink' },
    envelope: { attack: .008, decay: .045, sustain: 0, release: .025 } }).connect(filter)
  return {
    // Open-hat articulation does not change the shaker's rhythm or timbre.
    play: (hit, time) => voice.triggerAttackRelease(.035, time, hit.velocity ?? .6),
    dispose() { voice.dispose(); filter.dispose() },
  }
}

function createSnare(output: Tone.Gain): Instrument {
  const snare = createNoise(output, 1400, -22, .12)
  const rim = new Tone.Synth({ volume: -20, oscillator: { type: 'triangle' },
    envelope: { attack: .001, decay: .018, sustain: 0, release: .015 } }).connect(output)
  return {
    play(hit, time, stepSeconds) {
      if (hit.articulation === 'rim') rim.triggerAttackRelease('G5', .02, time, hit.velocity ?? .6)
      else snare.play(hit, time, stepSeconds)
    },
    dispose() { snare.dispose(); rim.dispose() },
  }
}

export function createGrooveAudio(output: Tone.Gain) {
  const arrangement = chooseStyleArrangement()
  const selection = arrangement.patterns
  const musicInstruments = arrangement.instruments
  const instruments: Record<LayerId, Instrument> = {
    kick: createKick(output),
    snare: createSnare(output),
    hats: createTimekeeper(output, musicInstruments.timekeeper),
    bass: createBass(output, selection.bass, musicInstruments.bass),
    synth: createLead(output, selection.synth, musicInstruments.lead),
    pad: createChords(output, selection.pad, musicInstruments.chords),
  }
  let timer: ReturnType<typeof window.setInterval> | undefined

  function playStep(step: number, time: number, stepSeconds: number, layers: number) {
    for (const { id, entryBar } of GROOVE_LAYERS.slice(0, layers)) {
      const phraseStep = step - (entryBar - 1) * 16
      if (phraseStep < 0) continue
      for (const hit of hitsAtStep(selection[id], phraseStep)) {
        instruments[id].play(hit, time, stepSeconds)
      }
    }
  }

  const clock = createGrooveClock(playStep)
  function schedule(start: number, beatSeconds: number, layers: number) {
    clock.configure(start, beatSeconds, layers)
    clock.pump(Tone.immediate())
  }
  function continuePlayback() {
    // Keep pumping after the level animation stops; disposal owns cleanup.
    timer ??= window.setInterval(() => clock.pump(Tone.immediate()), 25)
  }

  return {
    musicInstruments,
    styleName: arrangement.style.name,
    schedule,
    continuePlayback,
    dispose() { window.clearInterval(timer); Object.values(instruments).forEach((instrument) => instrument.dispose()) },
  }
}
