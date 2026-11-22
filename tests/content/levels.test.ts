import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { levelSchema, type LevelFile } from './levelSchema'

const levelsFolder = fileURLToPath(new URL('../../src/content/levels/', import.meta.url))
const levelFileNames = readdirSync(levelsFolder).filter((name) => name.endsWith('.json'))

function readLevel(fileName: string): unknown {
  return JSON.parse(readFileSync(levelsFolder + fileName, 'utf8'))
}

describe('level files', () => {
  it('level_folder_holds_at_least_one_level', () => {
    expect(levelFileNames.length).toBeGreaterThan(0)
  })

  it.each(levelFileNames)('level_file_%s_matches_the_level_format', (fileName) => {
    const result = levelSchema.safeParse(readLevel(fileName))

    expect(result.error?.issues ?? []).toEqual([])
  })

  it('level_ids_are_unique', () => {
    const ids = levelFileNames.map((fileName) => (readLevel(fileName) as LevelFile).id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('placeholder level', () => {
  const placeholders = levelFileNames.map((fileName) => readLevel(fileName) as LevelFile).filter((level) => level.placeholder)

  it('one_level_is_marked_as_placeholder', () => {
    expect(placeholders).toHaveLength(1)
  })

  // "About 400 units": within 10%
  it('placeholder_level_is_about_400_units_long', () => {
    expect(placeholders[0].length).toBeGreaterThanOrEqual(360)
    expect(placeholders[0].length).toBeLessThanOrEqual(440)
  })

  it('placeholder_level_has_gate_rows_every_40_to_60_units', () => {
    const gateRowZs = placeholders[0].events.filter((event) => event.type === 'gates').map((event) => event.z)

    expect(gateRowZs.length).toBeGreaterThan(1)
    gateRowZs.slice(1).forEach((z, index) => {
      expect(z - gateRowZs[index]).toBeGreaterThanOrEqual(40)
      expect(z - gateRowZs[index]).toBeLessThanOrEqual(60)
    })
  })

  it('placeholder_level_has_a_puppy_wave_between_every_two_gate_rows', () => {
    const events = placeholders[0].events
    const gateRowZs = events.filter((event) => event.type === 'gates').map((event) => event.z)
    const waveZs = events.filter((event) => event.type === 'wave').map((event) => event.z)

    gateRowZs.slice(1).forEach((z, index) => {
      expect(waveZs.some((waveZ) => waveZ > gateRowZs[index] && waveZ < z)).toBe(true)
    })
  })

  it('placeholder_level_uses_all_four_wave_patterns', () => {
    const patterns = new Set(
      placeholders[0].events.flatMap((event) => (event.type === 'wave' ? [event.pattern] : [])),
    )

    expect(patterns).toEqual(new Set(['line', 'block', 'column', 'flank']))
  })
})
