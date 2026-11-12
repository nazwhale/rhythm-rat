export type Settlement = 'village' | 'town' | 'city'

export type SceneryLayer = {
  urbanity: number
  density: number
  offset: number
  variant: number
  settlement: Settlement
}

export function settlementAt(urbanity: number): Settlement {
  return urbanity < 1 / 3 ? 'village' : urbanity < 2 / 3 ? 'town' : 'city'
}

export function sceneryForLevel(levelIndex: number, levelCount: number): { skyline: SceneryLayer; street: SceneryLayer } {
  const count = Math.max(1, levelCount)
  const index = Math.max(0, Math.min(count - 1, levelIndex))
  const progress = count === 1 ? 0 : index / (count - 1)
  // The city appears on the horizon before the runner reaches its streets.
  const skylineUrbanity = progress ** 0.75
  const streetUrbanity = progress ** 1.35
  return {
    skyline: { urbanity: skylineUrbanity, density: 4 + Math.floor(skylineUrbanity * 13), offset: index * 137 % 960, variant: index % 4, settlement: settlementAt(skylineUrbanity) },
    street: { urbanity: streetUrbanity, density: 3 + Math.floor(streetUrbanity * 2), offset: (index * 223 + 71) % 960, variant: (index + 1) % 4, settlement: settlementAt(streetUrbanity) },
  }
}

// Two distinct tiles are repeated twice, so wrapping never changes the artwork.
export const SCENERY_TILE_WIDTH = 960
export const SCENERY_PERIOD = SCENERY_TILE_WIDTH * 2
export function sceneryScroll(distance: number, speed: number, offset: number) {
  return -((Math.max(0, distance) * speed + offset) % SCENERY_PERIOD)
}
