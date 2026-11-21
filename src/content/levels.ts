import type { Level } from './level'

// Levels are bundled at build time, so they are not validated at runtime.
const levelFiles = import.meta.glob<Level>('./levels/*.json', { eager: true, import: 'default' })

export const levels: Level[] = Object.values(levelFiles)
