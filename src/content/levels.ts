import type { Level } from './level'

// Levels are bundled at build time; tests/content/levels.test.ts validates every file.
const levelFiles = import.meta.glob<Level>('./levels/*.json', { eager: true, import: 'default' })

export const levels: Level[] = Object.values(levelFiles)
