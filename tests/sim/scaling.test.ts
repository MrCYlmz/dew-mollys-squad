import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type GameEvent } from '../../src/sim/run'
import { copied, levelOf, noSteering, stepUntil } from './runHarness'

type WaveEvent = Extract<Level['events'][number], { type: 'wave' }>

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
    xs.forEach((x, index) => expect(x).toBeCloseTo(-5 + (10 * (index + 0.5)) / 11, 9))
  })

  it('line_of_5_on_level_2_keeps_5_enemies', () => {
    // 5 × 1.05 = 5.25, rounded to 5
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 5 }, 2)

    expect(run.state.enemies).toHaveLength(5)
  })

  it('line_on_level_1_keeps_its_count', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 10 }, 1)

    expect(run.state.enemies).toHaveLength(10)
  })

  it('block_of_4_rows_on_level_5_grows_backwards_to_5_rows_of_the_same_width', () => {
    // 4 × 1.05⁴ = 4.86, so 5 rows of 5
    const run = spawnWave({ type: 'wave', z: 130, enemy: 'puppy', pattern: 'block', columns: 5, rows: 4, x: 0, spacing: 1.5 }, 5)

    const xs = new Set(run.state.enemies.map((enemy) => Math.round(enemy.x * 100) / 100))
    const rowZs = [...new Set(run.state.enemies.map((enemy) => Math.round(enemy.z * 10) / 10))].sort((a, b) => a - b)
    expect(run.state.enemies).toHaveLength(25)
    expect(xs).toEqual(new Set([-3, -1.5, 0, 1.5, 3]))
    expect(rowZs).toHaveLength(5)
    rowZs.slice(1).forEach((z, index) => expect(z - rowZs[index]).toBeCloseTo(1.5, 1))
    expect(Math.abs(rowZs[0] - 130)).toBeLessThanOrEqual(0.15)
  })

  it('column_of_8_on_level_3_has_9_enemies_spacing_apart_from_z_back', () => {
    // 8 × 1.05² = 8.82, so 9
    const run = spawnWave({ type: 'wave', z: 180, enemy: 'puppy', pattern: 'column', count: 8, x: -3, spacing: 2 }, 3)

    const zs = run.state.enemies.map((enemy) => enemy.z).sort((a, b) => a - b)
    expect(zs).toHaveLength(9)
    zs.forEach((z, index) => expect(Math.abs(z - (180 + 2 * index))).toBeLessThanOrEqual(0.15))
    for (const enemy of run.state.enemies) expect(enemy.x).toBe(-3)
  })

  it('flank_of_4_on_level_5_has_5_enemies_per_side', () => {
    const run = spawnWave({ type: 'wave', z: 230, enemy: 'puppy', pattern: 'flank', count: 4, spacing: 2 }, 5)

    expect(run.state.enemies.filter((enemy) => enemy.x < 0)).toHaveLength(5)
    expect(run.state.enemies.filter((enemy) => enemy.x > 0)).toHaveLength(5)
  })
})
