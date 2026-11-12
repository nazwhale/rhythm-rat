export type Settlement = 'village' | 'town' | 'city'

// Relative thirds keep the journey intact as more levels are added.
export function settlementForLevel(levelIndex: number, levelCount: number): Settlement {
  const count = Math.max(1, levelCount)
  const index = Math.max(0, Math.min(count - 1, levelIndex))
  return index * 3 < count ? 'village' : index * 3 < count * 2 ? 'town' : 'city'
}
