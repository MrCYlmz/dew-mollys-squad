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

// S-2 allows a second placeholder next to the first, so each rule holds for every placeholder level.
describe('placeholder levels', () => {
  const placeholders = levelFileNames.map((fileName) => readLevel(fileName) as LevelFile).filter((level) => level.placeholder)

  it('at_least_one_level_is_marked_as_placeholder', () => {
    expect(placeholders.length).toBeGreaterThan(0)
  })

  // "About 400 units": within 10%
  it('placeholder_level_is_about_400_units_long', () => {
    for (const level of placeholders) {
      expect(level.length).toBeGreaterThanOrEqual(360)
      expect(level.length).toBeLessThanOrEqual(440)
    }
  })

  it('placeholder_level_has_gate_rows_every_40_to_60_units', () => {
    for (const level of placeholders) {
      const gateRowZs = level.events.filter((event) => event.type === 'gates').map((event) => event.z)

      expect(gateRowZs.length).toBeGreaterThan(1)
      gateRowZs.slice(1).forEach((z, index) => {
        expect(z - gateRowZs[index]).toBeGreaterThanOrEqual(40)
        expect(z - gateRowZs[index]).toBeLessThanOrEqual(60)
      })
    }
  })

  it('placeholder_level_has_a_wave_between_every_two_gate_rows', () => {
    for (const level of placeholders) {
      const gateRowZs = level.events.filter((event) => event.type === 'gates').map((event) => event.z)
      const waveZs = level.events.filter((event) => event.type === 'wave').map((event) => event.z)

      gateRowZs.slice(1).forEach((z, index) => {
        expect(waveZs.some((waveZ) => waveZ > gateRowZs[index] && waveZ < z)).toBe(true)
      })
    }
  })

  it('placeholder_levels_use_all_four_wave_patterns', () => {
    const patterns = new Set(placeholders.flatMap((level) => level.events.flatMap((event) => (event.type === 'wave' ? [event.pattern] : []))))

    expect(patterns).toEqual(new Set(['line', 'block', 'column', 'flank']))
  })

  it('placeholder_levels_have_every_enemy_of_world_1', () => {
    const enemies = new Set(placeholders.flatMap((level) => level.events.flatMap((event) => (event.type === 'wave' ? [event.enemy] : []))))

    expect(enemies).toEqual(new Set(['puppy', 'chihuahua', 'bulldog', 'shieldDog']))
  })

  it('placeholder_levels_have_every_weapon_buff_gate', () => {
    const ops = new Set(
      placeholders.flatMap((level) => level.events.flatMap((event) => (event.type === 'gates' ? [event.left.op, event.right.op] : []))),
    )

    for (const op of ['fireRate', 'damage', 'multiShot', 'range']) expect(ops).toContain(op)
  })

  it('placeholder_levels_have_a_barrel_and_a_wall', () => {
    const types = new Set(placeholders.flatMap((level) => level.events.map((event) => event.type)))

    expect(types).toContain('barrel')
    expect(types).toContain('wall')
  })
})
