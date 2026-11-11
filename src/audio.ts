import * as Tone from 'tone'

// A soft pitched bite with a very short, muffled crunch underneath.
export function createRunAudio(muted: boolean) {
  const output = new Tone.Gain(muted ? 0 : 1).toDestination()
  const metronome = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.003, decay: 0.06, sustain: 0, release: 0.04 },
  }).connect(output)
  const bite = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.004, decay: 0.045, sustain: 0, release: 0.035 },
    volume: -12,
  }).connect(output)
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 1400, rolloff: -24, Q: 0.5 }).connect(output)
  const crunch = new Tone.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 0.002, decay: 0.025, sustain: 0, release: 0.025 },
    volume: -21,
  }).connect(filter)

  return {
    metronome,
    munch() {
      // Avoid the transport lookahead so the bite responds to the actual tap.
      const time = Tone.immediate() + 0.005
      bite.triggerAttackRelease('E4', 0.045, time, 0.7)
      bite.frequency.exponentialRampToValueAtTime(Tone.Frequency('C4').toFrequency(), time + 0.065)
      crunch.triggerAttackRelease(0.025, time, 0.5)
    },
    setMuted(value: boolean) { output.gain.rampTo(value ? 0 : 1, 0.015) },
    dispose() {
      metronome.dispose()
      bite.dispose()
      crunch.dispose()
      filter.dispose()
      output.dispose()
    },
  }
}
