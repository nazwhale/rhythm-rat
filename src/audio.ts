import * as Tone from 'tone'
import { createGrooveAudio } from './grooveAudio'

import { createBiteAudio, type BiteSound } from './biteAudio'
export type { BiteSound } from './biteAudio'

// A soft pitched bite with a very short, muffled crunch underneath.
export function createRunAudio(muted: boolean, initialSound: BiteSound = 'nom') {
  const output = new Tone.Gain(muted ? 0 : 1).toDestination()
  const metronome = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.003, decay: 0.06, sustain: 0, release: 0.04 },
  }).connect(output)
  const biteAudio = createBiteAudio(output, initialSound)

  const grooveAudio = createGrooveAudio(output)

  return {
    metronome,
    musicInstruments: grooveAudio.musicInstruments,
    styleName: grooveAudio.styleName,
    groove: grooveAudio.schedule,
    continueMusic: grooveAudio.continuePlayback,
    munch: biteAudio.play,
    setSound: biteAudio.setSound,
    setMuted(value: boolean) { output.gain.rampTo(value ? 0 : 1, 0.015) },
    dispose() {
      grooveAudio.dispose()
      metronome.dispose()
      biteAudio.dispose()
      output.dispose()
    },
  }
}
