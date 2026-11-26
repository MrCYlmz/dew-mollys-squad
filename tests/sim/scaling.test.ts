import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type GameEvent } from '../../src/sim/run'
import { copied, levelOf, noSteering, stepUntil } from './runHarness'

type WaveEvent = Extract<Level['events'][number], { type: 'wave' }>

// At the spawn tick an enemy may already have chased the squad's centre one step across the track.
const chaseStep = tuning.enemyChaseSpeed / 60 + 1e-9

function spawnWave(wave: WaveEvent, level: number) {
  const run = createRun({ level: levelOf([wave], 300, level), seed: 1 })
  stepUntil(run, (state) => state.enemies.length > 0, 6000)
  return run
}

describe('enemy hp scaling', () => {
  it.each([
    [1, 3],
    [2, 3.24],
    [3, 3.4992],
  ])('puppy_on_level_%i_has_%s_hp', (level, hp) => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 1 }, level)

    expect(run.state.enemies[0].hp).toBeCloseTo(hp, 9)
  })

  it.each([
    ['chihuahua', 1.08],
    ['bulldog', 43.2],
  ] as const)('%s_on_level_2_has_its_hp_times_1_08', (enemy, hp) => {
    const run = spawnWave({ type: 'wave', z: 80, enemy, pattern: 'line', count: 1 }, 2)

    expect(run.state.enemies[0].hp).toBeCloseTo(hp, 9)
  })

  it.each([
    ['greyhound', 2.16],
    ['dalmatian', 12.96],
  ] as const)('%s_on_level_2_has_its_hp_times_1_08', (enemy, hp) => {
    const run = spawnWave({ type: 'wave', z: 80, enemy, pattern: 'line', count: 1 }, 2)

    expect(run.state.enemies[0].hp).toBeCloseTo(hp, 9)
  })

  // The example from docs/domain/levels.md: HP keeps growing past level 15, where the level speed stops growing.
  it('greyhound_on_level_16_has_2_times_1_08_to_the_15th_hp', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'greyhound', pattern: 'line', count: 1 }, 16)

    expect(run.state.enemies[0].hp).toBeCloseTo(6.3443, 4)
  })

  it('puppy_on_level_25_has_3_times_1_08_to_the_24th_hp', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 1 }, 25)

    expect(run.state.enemies[0].hp).toBeCloseTo(3 * 1.08 ** 24, 9)
  })

  it('shield_dog_on_level_2_has_its_shield_and_body_times_1_08', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'shieldDog', pattern: 'line', count: 1 }, 2)

    expect(run.state.enemies[0].shield).toBeCloseTo(32.4, 9)
    expect(run.state.enemies[0].hp).toBeCloseTo(16.2, 9)
  })

  it('puppy_on_level_2_survives_3_hits_with_a_fraction_of_hp_left', () => {
    // 3.24 → 2.24 → 1.24 → 0.24 → killed by the fourth yarn ball
    const run = spawnWave({ type: 'wave', z: 60, enemy: 'puppy', pattern: 'line', count: 1 }, 2)
    const hpSeen = [run.state.enemies[0].hp]
    const events: GameEvent[] = []

    while (run.state.enemies.length > 0 && run.state.status === 'running') {
      events.push(...copied(run.step(noSteering)))
      const hp = run.state.enemies[0]?.hp
      if (hp !== undefined && hp !== hpSeen[hpSeen.length - 1]) hpSeen.push(hp)
    }

    expect(hpSeen).toHaveLength(4)
    ;[3.24, 2.24, 1.24, 0.24].forEach((hp, index) => expect(hpSeen[index]).toBeCloseTo(hp, 9))
    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([
      expect.objectContaining({ type: 'enemyKilled', enemy: 'puppy', cause: 'shot' }),
    ])
  })
})

describe('wave size scaling', () => {
  it('line_of_10_on_level_2_has_11_enemies_spread_evenly_across_the_track', () => {
    // 10 × 1.05 = 10.5, rounded half up to 11
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 10 }, 2)

    const xs = run.state.enemies.map((enemy) => enemy.x).sort((a, b) => a - b)
    expect(xs).toHaveLength(11)
    xs.forEach((x, index) => expect(Math.abs(x - (-5 + (10 * (index + 0.5)) / 11))).toBeLessThanOrEqual(chaseStep))
  })

  it('line_of_5_on_level_2_keeps_5_enemies', () => {
    // 5 × 1.05 = 5.25, rounded to 5
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 5 }, 2)

    expect(run.state.enemies).toHaveLength(5)
  })

  it.each(['greyhound', 'dalmatian'] as const)('line_of_10_%ss_on_level_2_has_11', (enemy) => {
    const run = spawnWave({ type: 'wave', z: 80, enemy, pattern: 'line', count: 10 }, 2)

    expect(run.state.enemies).toHaveLength(11)
  })

  // Wave size keeps growing past level 15: 10 × 1.05¹⁹ = 25.27, so 25 on level 20.
  it('line_of_10_on_level_20_has_25_enemies', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'bulldog', pattern: 'line', count: 10 }, 20)

    expect(run.state.enemies).toHaveLength(25)
  })

  it('line_on_level_1_keeps_its_count', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 10 }, 1)

    expect(run.state.enemies).toHaveLength(10)
  })

  it('block_of_4_rows_on_level_5_grows_backwards_to_5_rows_of_the_same_width', () => {
    // 4 × 1.05⁴ = 4.86, so 5 rows of 5, from z 130 stretched by level 5's speed factor of 1.28, so 166.4
    const run = spawnWave({ type: 'wave', z: 130, enemy: 'puppy', pattern: 'block', columns: 5, rows: 4, x: 0, spacing: 1.5 }, 5)

    const columns = [-3, -1.5, 0, 1.5, 3]
    const rowZs = [...new Set(run.state.enemies.map((enemy) => Math.round(enemy.z * 10) / 10))].sort((a, b) => a - b)
    expect(run.state.enemies).toHaveLength(25)
    for (const column of columns) {
      expect(run.state.enemies.filter((enemy) => Math.abs(enemy.x - column) <= chaseStep)).toHaveLength(5)
    }
    expect(rowZs).toHaveLength(5)
    rowZs.slice(1).forEach((z, index) => expect(z - rowZs[index]).toBeCloseTo(1.5, 1))
    expect(Math.abs(rowZs[0] - 166.4)).toBeLessThanOrEqual(0.15)
  })

  it('column_of_8_on_level_3_has_9_enemies_spacing_apart_from_z_back', () => {
    // 8 × 1.05² = 8.82, so 9, from z 180 stretched by level 3's speed factor of 1.14, so 205.2
    const run = spawnWave({ type: 'wave', z: 180, enemy: 'puppy', pattern: 'column', count: 8, x: -3, spacing: 2 }, 3)

    const zs = run.state.enemies.map((enemy) => enemy.z).sort((a, b) => a - b)
    expect(zs).toHaveLength(9)
    zs.forEach((z, index) => expect(Math.abs(z - (205.2 + 2 * index))).toBeLessThanOrEqual(0.15))
    for (const enemy of run.state.enemies) expect(Math.abs(enemy.x - -3)).toBeLessThanOrEqual(chaseStep)
  })

  it('flank_of_4_on_level_5_has_5_enemies_per_side', () => {
    const run = spawnWave({ type: 'wave', z: 230, enemy: 'puppy', pattern: 'flank', count: 4, spacing: 2 }, 5)

    expect(run.state.enemies.filter((enemy) => enemy.x < 0)).toHaveLength(5)
    expect(run.state.enemies.filter((enemy) => enemy.x > 0)).toHaveLength(5)
  })
})
