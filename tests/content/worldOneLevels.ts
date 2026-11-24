import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Level } from '../../src/content/level'

const levelsFolder = fileURLToPath(new URL('../../src/content/levels/', import.meta.url))

export const worldOneLevelNumbers = Array.from({ length: 15 }, (_, index) => index + 1)

// The level file `level-<number>` of world 1, or null while it does not exist.
export function worldOneLevel(number: number): Level | null {
  const path = `${levelsFolder}level-${number}.json`
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Level) : null
}
