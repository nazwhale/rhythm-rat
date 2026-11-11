import { parseLevel } from './level'

// New JSON files are discovered automatically; ratings are provisional difficulty seeds.
const files = import.meta.glob('./levels/*.json', { eager: true, import: 'default' })
export const LEVELS = Object.values(files).map(parseLevel).sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id))
if (!LEVELS.length || new Set(LEVELS.map((level) => level.id)).size !== LEVELS.length) throw new Error('Levels must have unique ids')
