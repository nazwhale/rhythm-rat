import { pickRandom } from './groove.ts'

export const LEAD_INSTRUMENTS = [
  { id: 'synth', name: 'Synth lead', icon: 'synth' },
  { id: 'guitar', name: 'Guitar lead', icon: 'guitar' },
  { id: 'flute', name: 'Flute lead', icon: 'flute' },
  { id: 'trumpet', name: 'Trumpet lead', icon: 'trumpet' },
] as const
export const CHORD_INSTRUMENTS = [
  { id: 'pad', name: 'Synth pad', icon: 'pad' },
  { id: 'piano', name: 'Piano chords', icon: 'piano' },
  { id: 'guitar', name: 'Guitar chords', icon: 'guitar' },
] as const
export const BASS_INSTRUMENTS = [
  { id: 'synth', name: 'Synth bass', icon: 'synthBass' },
  { id: 'bassGuitar', name: 'Bass guitar', icon: 'bass' },
  { id: 'doubleBass', name: 'Double bass', icon: 'doubleBass' },
] as const
export const TIMEKEEPER_INSTRUMENTS = [
  { id: 'hiHat', name: 'Hi-hats', icon: 'hats' },
  { id: 'shaker', name: 'Shaker', icon: 'shaker' },
] as const
export type TimekeeperInstrument = typeof TIMEKEEPER_INSTRUMENTS[number]
export type BassInstrument = typeof BASS_INSTRUMENTS[number]
export type LeadInstrument = typeof LEAD_INSTRUMENTS[number]
export type ChordInstrument = typeof CHORD_INSTRUMENTS[number]
export type MusicInstruments = { lead: LeadInstrument; chords: ChordInstrument; bass: BassInstrument; timekeeper: TimekeeperInstrument }
export type MusicIcon = LeadInstrument['icon'] | ChordInstrument['icon'] | BassInstrument['icon'] | TimekeeperInstrument['icon'] | 'kick' | 'snare' | 'hats' | 'bass'

export function chooseLeadInstrument(random: () => number = Math.random): LeadInstrument {
  return pickRandom(LEAD_INSTRUMENTS, random)
}
export function chooseChordInstrument(random: () => number = Math.random): ChordInstrument {
  return pickRandom(CHORD_INSTRUMENTS, random)
}
export function chooseBassInstrument(random: () => number = Math.random): BassInstrument {
  return pickRandom(BASS_INSTRUMENTS, random)
}
export function chooseTimekeeperInstrument(random: () => number = Math.random): TimekeeperInstrument {
  return pickRandom(TIMEKEEPER_INSTRUMENTS, random)
}
export function chooseMusicInstruments(random: () => number = Math.random): MusicInstruments {
  return { lead: chooseLeadInstrument(random), chords: chooseChordInstrument(random), bass: chooseBassInstrument(random), timekeeper: chooseTimekeeperInstrument(random) }
}
