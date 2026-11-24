import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { EnemyKind, Gate, GateOp, Level } from '../../src/content/level'
import { levelSchema, type LevelFile } from './levelSchema'
import { worldOneLevel, worldOneLevelNumbers } from './worldOneLevels'

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

// requirements S-6 (1–6): the ten levels of world 1, following "The first world (MVP)" in docs/domain/levels.md.

function level(number: number): Level {
  const found = worldOneLevel(number)
  if (found === null) throw new Error(`level-${number}.json is missing`)
  return found
}

function gates(of: Level): Gate[] {
  return of.events.flatMap((event) => (event.type === 'gates' ? [event.left, event.centre, event.right].flatMap((gate) => (gate ? [gate] : [])) : []))
}

function gateRows(of: Level) {
  return of.events.flatMap((event) => (event.type === 'gates' ? [event] : []))
}

// Kinds sent by waves or by the stream.
function enemyKinds(of: Level): Set<EnemyKind> {
  return new Set([...of.events.flatMap((event) => (event.type === 'wave' ? [event.enemy] : [])), ...of.stream.enemies])
}

function count(of: Level, type: Level['events'][number]['type']): number {
  return of.events.filter((event) => event.type === type).length
}

const weaponBuffOps: GateOp[] = ['fireRate', 'damage', 'multiShot', 'range']
const badOps: GateOp[] = ['subtract', 'divide']

describe('world 1 level files', () => {
  it('there_are_exactly_ten_level_files_level_1_to_level_10', () => {
    expect([...levelFileNames].sort()).toEqual(worldOneLevelNumbers.map((number) => `level-${number}.json`).sort())
  })

  it.each(worldOneLevelNumbers)('level_file_level_%i_has_its_number_as_id_and_level', (number) => {
    expect(level(number).id).toBe(`level-${number}`)
    expect(level(number).level).toBe(number)
  })

  it.each(worldOneLevelNumbers)('level_%i_is_no_placeholder', (number) => {
    expect(level(number)).not.toHaveProperty('placeholder')
  })
})

describe('world 1 level lengths', () => {
  it.each(worldOneLevelNumbers)('level_%i_road_is_300_to_600_units_long', (number) => {
    expect(level(number).length).toBeGreaterThanOrEqual(300)
    expect(level(number).length).toBeLessThanOrEqual(600)
  })

  // Level 6, the level after the first boss, may be shorter than level 5.
  it.each(worldOneLevelNumbers.slice(1).filter((number) => number !== 6))('level_%i_is_not_shorter_than_the_level_before', (number) => {
    expect(level(number).length).toBeGreaterThanOrEqual(level(number - 1).length)
  })
})

describe('world 1 progression', () => {
  it.each([1, 2, 3])('level_%i_has_only_puppies', (number) => {
    expect(enemyKinds(level(number))).toEqual(new Set(['puppy']))
  })

  it.each([1, 2, 3])('level_%i_has_only_add_subtract_multiply_and_divide_gates', (number) => {
    for (const gate of gates(level(number))) expect(['add', 'subtract', 'multiply', 'divide']).toContain(gate.op)
  })

  it.each([1, 2, 3])('level_%i_has_no_barrels_and_no_walls', (number) => {
    expect(count(level(number), 'barrel')).toBe(0)
    expect(count(level(number), 'wall')).toBe(0)
  })

  it.each([1, 2])('level_%i_has_no_buff_blocks', (number) => {
    expect(count(level(number), 'buffBlock')).toBe(0)
  })

  it('level_3_has_at_least_two_buff_blocks', () => {
    expect(count(level(3), 'buffBlock')).toBeGreaterThanOrEqual(2)
  })

  it.each([4, 5, 6])('level_%i_has_chihuahuas', (number) => {
    expect(enemyKinds(level(number))).toContain('chihuahua')
  })

  it.each([4, 5, 6])('level_%i_has_at_least_one_barrel', (number) => {
    expect(count(level(number), 'barrel')).toBeGreaterThanOrEqual(1)
  })

  it.each([4, 5, 6])('level_%i_has_at_least_two_weapon_buff_gates', (number) => {
    expect(gates(level(number)).filter((gate) => weaponBuffOps.includes(gate.op)).length).toBeGreaterThanOrEqual(2)
  })

  it.each(worldOneLevelNumbers.filter((number) => number >= 4))('level_%i_has_at_least_two_walls', (number) => {
    expect(count(level(number), 'wall')).toBeGreaterThanOrEqual(2)
  })

  it.each(worldOneLevelNumbers.filter((number) => number >= 3))('level_%i_has_at_least_one_buff_block', (number) => {
    expect(count(level(number), 'buffBlock')).toBeGreaterThanOrEqual(1)
  })

  it.each([7, 8, 9])('level_%i_has_bulldogs_and_shield_dogs', (number) => {
    expect(enemyKinds(level(number))).toContain('bulldog')
    expect(enemyKinds(level(number))).toContain('shieldDog')
  })

  // A bad choice is a red gate (subtract or divide); a good one is any blue gate in the same row.
  it.each([7, 8, 9])('level_%i_has_a_bad_choice_next_to_a_good_one_in_at_least_half_of_its_gate_rows', (number) => {
    const rows = gateRows(level(number))
    const tightRows = rows.filter((row) => {
      const ops = [row.left, row.centre, row.right].flatMap((gate) => (gate ? [gate.op] : []))
      return ops.some((op) => badOps.includes(op)) && ops.some((op) => !badOps.includes(op))
    })

    expect(rows.length).toBeGreaterThan(0)
    expect(tightRows.length * 2).toBeGreaterThanOrEqual(rows.length)
  })

  it('level_10_has_all_four_enemy_kinds', () => {
    expect(enemyKinds(level(10))).toEqual(new Set(['puppy', 'chihuahua', 'bulldog', 'shieldDog']))
  })

  it.each(worldOneLevelNumbers)('level_%i_has_the_boss_of_world_1_only_on_levels_5_and_10', (number) => {
    const bosses = level(number).events.flatMap((event) => (event.type === 'boss' ? [event.boss] : []))
    const expected = number === 5 ? ['dustbot'] : number === 10 ? ['megaDustbot'] : []

    expect(bosses).toEqual(expected)
  })
})

describe('world 1 streams', () => {
  it.each(worldOneLevelNumbers.slice(1))('level_%i_stream_interval_is_not_longer_than_the_level_before', (number) => {
    expect(level(number).stream.interval).toBeLessThanOrEqual(level(number - 1).stream.interval)
  })

  it('level_1_stream_interval_is_at_least_2_seconds', () => {
    expect(level(1).stream.interval).toBeGreaterThanOrEqual(2)
  })

  // Tightened in the PO's PR review from 1 s.
  it('level_10_stream_interval_is_at_most_0_8_seconds', () => {
    expect(level(10).stream.interval).toBeLessThanOrEqual(0.8)
  })
})

describe('world 1 rhythm', () => {
  it.each(worldOneLevelNumbers)('level_%i_has_40_to_60_units_between_neighbouring_gate_rows', (number) => {
    const zs = gateRows(level(number)).map((row) => row.z)

    expect(zs.length).toBeGreaterThan(1)
    zs.slice(1).forEach((z, index) => {
      expect(z - zs[index]).toBeGreaterThanOrEqual(40)
      expect(z - zs[index]).toBeLessThanOrEqual(60)
    })
  })

  // Full windows are 0–100, 100–200 and so on, each holding the rows from its start up to, not including, its end;
  // the part of the road after the last full window is not checked.
  it.each(worldOneLevelNumbers)('level_%i_has_1_to_2_gate_rows_in_every_full_100_unit_window', (number) => {
    const { length } = level(number)
    const zs = gateRows(level(number)).map((row) => row.z)

    for (let start = 0; start + 100 <= length; start += 100) {
      const rowsInWindow = zs.filter((z) => z >= start && z < start + 100).length
      expect(rowsInWindow, `gate rows from z = ${start}`).toBeGreaterThanOrEqual(1)
      expect(rowsInWindow, `gate rows from z = ${start}`).toBeLessThanOrEqual(2)
    }
  })

  // The same windows as for gate rows; a wave counts in the window of its z, where its front row stands.
  it.each(worldOneLevelNumbers)('level_%i_has_1_to_2_waves_in_every_full_100_unit_window', (number) => {
    const { length, events } = level(number)
    const zs = events.flatMap((event) => (event.type === 'wave' ? [event.z] : []))

    for (let start = 0; start + 100 <= length; start += 100) {
      const wavesInWindow = zs.filter((z) => z >= start && z < start + 100).length
      expect(wavesInWindow, `waves from z = ${start}`).toBeGreaterThanOrEqual(1)
      expect(wavesInWindow, `waves from z = ${start}`).toBeLessThanOrEqual(2)
    }
  })
})
