import * as Tone from 'tone'

export const BITE_SOUND_GROUPS = [
  { label: 'Bites & crunches', options: [
    { id: 'nom', label: 'Soft nom' }, { id: 'crunch', label: 'Crunch' },
    { id: 'chip', label: 'Crispy chip' }, { id: 'cracker', label: 'Cracker snap' },
    { id: 'apple', label: 'Apple bite' },
  ] },
  { label: 'Instruments', options: [
    { id: 'pluck', label: 'Soft pluck' }, { id: 'marimba', label: 'Marimba' },
    { id: 'guitar', label: 'Guitar' }, { id: 'flute', label: 'Flute' },
    { id: 'bell', label: 'Bell' }, { id: 'cowbell', label: 'Cowbell' },
  ] },
  { label: 'Silent', options: [{ id: 'quiet', label: 'No bite sound' }] },
] as const
export type BiteSound = typeof BITE_SOUND_GROUPS[number]['options'][number]['id']

type MusicalSound = 'marimba' | 'guitar' | 'flute' | 'bell' | 'cowbell'
function isMusicalSound(sound: BiteSound): sound is MusicalSound {
  return ['marimba', 'guitar', 'flute', 'bell', 'cowbell'].includes(sound)
}

// Synthesized instrument approximations: no sample downloads or loading delays.
function createInstrument(sound: MusicalSound, output: Tone.Gain) {
  if (sound === 'cowbell') return new Tone.FMSynth({ volume: -25,
    harmonicity: 1.48, modulationIndex: 1.2,
    oscillator: { type: 'square' }, modulation: { type: 'square' },
    envelope: { attack: .001, decay: .1, sustain: 0, release: .025 },
    modulationEnvelope: { attack: .001, decay: .06, sustain: 0, release: .02 },
  }).connect(output)
  if (sound === 'guitar') return new Tone.PluckSynth({ volume: -17,
    attackNoise: 1, dampening: 3200, resonance: .84 }).connect(output)
  if (sound === 'flute') return new Tone.Synth({ volume: -20,
    oscillator: { type: 'sine' },
    envelope: { attack: .018, decay: .06, sustain: .65, release: .07 } }).connect(output)
  return new Tone.FMSynth({ volume: sound === 'bell' ? -24 : -16,
    harmonicity: sound === 'bell' ? 3.5 : 4,
    modulationIndex: sound === 'bell' ? 2 : 1.2,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: .001, decay: sound === 'bell' ? .5 : .16, sustain: 0, release: .08 },
    modulationEnvelope: { attack: .001, decay: .06, sustain: 0, release: .04 },
  }).connect(output)
}

const CRUNCHES = {
  nom: { cutoff: 1500, decay: .025, volume: -21, duration: .025, second: 0 },
  crunch: { cutoff: 1500, decay: .025, volume: -1, duration: .045, second: .055 },
  chip: { cutoff: 4200, decay: .035, volume: -9, duration: .03, second: .035 },
  cracker: { cutoff: 2800, decay: .012, volume: -5, duration: .012, second: .065 },
  apple: { cutoff: 850, decay: .065, volume: -8, duration: .055, second: .07 },
} as const

export function createBiteAudio(output: Tone.Gain, initialSound: BiteSound) {
  let sound = initialSound
  const instruments = new Map<MusicalSound, ReturnType<typeof createInstrument>>()
  const bite = new Tone.Synth({ oscillator: { type: 'sine' }, volume: -12,
    envelope: { attack: .004, decay: .045, sustain: 0, release: .035 } }).connect(output)
  const filter = new Tone.Filter({ type: 'bandpass', frequency: 1500, rolloff: -12, Q: .7 }).connect(output)
  const crunch = new Tone.NoiseSynth({ noise: { type: 'pink' }, volume: -21,
    envelope: { attack: .002, decay: .025, sustain: 0, release: .025 } }).connect(filter)

  function prepareInstrument(value: BiteSound) {
    if (isMusicalSound(value) && !instruments.has(value)) instruments.set(value, createInstrument(value, output))
  }
  prepareInstrument(sound)

  function play(variant = Math.floor(Math.random() * 3)) {
    if (sound === 'quiet') return
    const time = Tone.immediate() + .005
    const index = variant % 3
    if (isMusicalSound(sound)) {
      // Keep melodic feedback compatible with the backing groove's C minor.
      instruments.get(sound)!.triggerAttackRelease(sound === 'cowbell' ? 560 : ['C4', 'Eb4', 'G4'][index], sound === 'flute' ? .12 : .08, time, .7)
      return
    }
    const pitch = [.94, 1, 1.07][index]
    if (sound === 'nom' || sound === 'pluck') {
      bite.triggerAttackRelease(Tone.Frequency(sound === 'pluck' ? 'G4' : 'E4').toFrequency() * pitch, .045, time, .65)
      bite.frequency.exponentialRampToValueAtTime(Tone.Frequency(sound === 'pluck' ? 'E4' : 'C4').toFrequency() * pitch, time + .065)
    }
    if (sound === 'pluck') return
    const texture = CRUNCHES[sound]
    filter.frequency.setValueAtTime(texture.cutoff * pitch, time)
    crunch.volume.value = texture.volume
    crunch.envelope.decay = texture.decay
    crunch.triggerAttackRelease(texture.duration, time, sound === 'nom' ? .5 : .85)
    if (texture.second) crunch.triggerAttackRelease(.02, time + texture.second, .5)
  }

  return {
    play,
    setSound(value: BiteSound) { prepareInstrument(value); sound = value },
    dispose() {
      instruments.forEach((instrument) => instrument.dispose())
      bite.dispose(); crunch.dispose(); filter.dispose()
    },
  }
}
