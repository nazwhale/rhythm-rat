// Exactly 100 words: rat features, habitats, food, movement and tiny adventures.
export const RAT_WORDS = [
  'Rat', 'Mouse', 'Whisker', 'Tail', 'Paw', 'Snout', 'Nibble', 'Squeak', 'Scurry', 'Scamper',
  'Cheese', 'Cheddar', 'Gouda', 'Edam', 'Brie', 'Swiss', 'Crumb', 'Cracker', 'Biscuit', 'Oat',
  'Barley', 'Rye', 'Millet', 'Seed', 'Peanut', 'Walnut', 'Hazelnut', 'Almond', 'Acorn', 'Berry',
  'Apple', 'Pear', 'Peach', 'Plum', 'Cherry', 'Grape', 'Raisin', 'Fig', 'Date', 'Melon',
  'Pantry', 'Cupboard', 'Burrow', 'Tunnel', 'Nest', 'Nook', 'Attic', 'Cellar', 'Garden', 'Hedge',
  'Meadow', 'Willow', 'Clover', 'Moss', 'Fern', 'Bramble', 'Thistle', 'Daisy', 'Poppy', 'Bamboo',
  'Velvet', 'Fuzzy', 'Fluffy', 'Silky', 'Scruffy', 'Tiny', 'Little', 'Pocket', 'Mini', 'Cozy',
  'Swift', 'Nimble', 'Sneaky', 'Curious', 'Clever', 'Brave', 'Merry', 'Sleepy', 'Bouncy', 'Zippy',
  'Pitter', 'Patter', 'Tiptoe', 'Twitch', 'Wiggle', 'Wobble', 'Shuffle', 'Dart', 'Dash', 'Hop',
  'Moon', 'Dusk', 'Midnight', 'Shadow', 'Lantern', 'Spark', 'Pebble', 'Button', 'Thimble', 'Treasure',
] as const
export function randomUsername() {
  const [a, b] = crypto.getRandomValues(new Uint32Array(2))
  // Pick two different words. The database handles collisions between users.
  const first = a % RAT_WORDS.length
  const second = (first + 1 + b % (RAT_WORDS.length - 1)) % RAT_WORDS.length
  return RAT_WORDS[first] + RAT_WORDS[second]
}
