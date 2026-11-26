import { afterEach, describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { bossLevelOf, doublingRows, everyLane, levelOf, noSteering, steerTo, stepTicks, stepToArena, stepUntil } from './runHarness'

// requirements S-11 (1–4), S-12 (8) and docs/domain/run.md "Level speed": each level runs at 12 units/s × its speed factor,
// 1 + 0.07 × (min(level number, 15) − 1), and the road distances of its level file are stretched by that factor.

// Speed factors and level speeds from the examples in docs/domain/run.md and levels.md.
const level15Factor = 1.98
const level15Speed = 23.76
const level15Step = level15Speed / 60

function runOn(level: number, events: Level['events'] = [], length = 300, stream?: Level['stream']): Run {
  return createRun({ level: levelOf(events, length, level, stream), seed: 1 })
}

// Ticks from the start of the run until reached holds, counting the run's first tick as tick 1.
function ticksUntil(run: Run, reached: (events: readonly GameEvent[]) => boolean, maxTicks = 6000): number {
  for (let tick = 1; tick <= maxTicks; tick++) {
    if (reached(run.step(noSteering))) return tick
  }
  throw new Error(`not reached in ${maxTicks} ticks`)
}

// A new shot leaves from the cats, behind every yarn ball already in flight, so the nearest yarn ball moves back only then.
function stepToNextShot(run: Run): void {
  const nearestZ = (yarnBalls: readonly { z: number }[]) => Math.min(...yarnBalls.map((yarnBall) => yarnBall.z))
  let nearest = nearestZ(run.state.yarnBalls)
  stepUntil(
    run,
    (state) => {
      const shot = nearestZ(state.yarnBalls) < nearest
      nearest = nearestZ(state.yarnBalls)
      return shot
    },
    120,
  )
}

describe('level speed', () => {
  it.each([
    [1, 12],
    [2, 12.84],
    [10, 19.56],
    [15, 23.76],
    [16, 23.76],
    [20, 23.76],
    [25, 23.76],
  ])('squad_on_level_%i_travels_%d_units_per_second', (level, speed) => {
    const run = runOn(level)

    stepTicks(run, 60)

    expect(run.state.squad.z).toBeCloseTo(speed, 6)
  })

  it('level_speed_stays_the_same_for_the_whole_road', () => {
    const run = runOn(15, [], 400)

    stepTicks(run, 60)
    expect(run.state.squad.z).toBeCloseTo(level15Speed, 6)

    stepTicks(run, 1200)
    expect(run.state.squad.z).toBeCloseTo(21 * level15Speed, 6)
  })

  it('squad_on_level_15_moves_about_twice_as_fast_as_on_level_1', () => {
    const level1 = runOn(1)
    const level15 = runOn(15)

    stepTicks(level1, 60)
    stepTicks(level15, 60)

    expect(level15.state.squad.z / level1.state.squad.z).toBeCloseTo(level15Factor, 6)
  })

  it('squad_on_level_16_moves_no_faster_than_on_level_15', () => {
    const level15 = runOn(15)
    const level16 = runOn(16)

    stepTicks(level15, 60)
    stepTicks(level16, 60)

    expect(level16.state.squad.z).toBeCloseTo(level15.state.squad.z, 9)
  })

  describe('with another speed growth in the tuning config', () => {
    const documentedGrowth = tuning.scaling.speedGrowth
    const documentedLastLevel = tuning.scaling.speedGrowthLastLevel

    afterEach(() => {
      tuning.scaling.speedGrowth = documentedGrowth
      tuning.scaling.speedGrowthLastLevel = documentedLastLevel
    })

    // With the speed growth's last level at 3, level 5 runs at level 3's speed factor of 1.14, so 13.68 units/s.
    it('speed_factor_stops_growing_at_the_speed_growth_last_level', () => {
      tuning.scaling.speedGrowthLastLevel = 3
      const run = runOn(5)

      stepTicks(run, 60)

      expect(run.state.squad.z).toBeCloseTo(13.68, 6)
    })

    // A speed growth of 0.1 gives level 3 a speed factor of 1.2, so 14.4 units/s.
    it('speed_factor_grows_by_the_speed_growth_per_level', () => {
      tuning.scaling.speedGrowth = 0.1
      const run = runOn(3)

      stepTicks(run, 60)

      expect(run.state.squad.z).toBeCloseTo(14.4, 6)
    })
  })
})

describe('stretched distances', () => {
  // The example from docs/domain/run.md: a gate row at z 60 stands at 118.8 on level 15, and the squad meets it after 5 s.
  it('gate_row_on_level_15_stands_at_its_z_times_1_98', () => {
    const run = runOn(15, [{ type: 'gates', z: 60, ...everyLane({ op: 'add', value: 1 }) }], 400)

    expect(run.state.gateRows.map((row) => row.z)).toEqual([expect.closeTo(118.8, 6)])
  })

  it.each([16, 25])('gate_row_on_level_%i_stands_at_its_z_times_1_98_as_on_level_15', (level) => {
    const run = runOn(level, [{ type: 'gates', z: 60, ...everyLane({ op: 'add', value: 1 }) }], 400)

    expect(run.state.gateRows.map((row) => row.z)).toEqual([expect.closeTo(118.8, 6)])
  })

  it.each([1, 15, 25])('squad_on_level_%i_meets_a_gate_row_at_z_60_after_5_seconds', (level) => {
    const run = runOn(level, [{ type: 'gates', z: 60, ...everyLane({ op: 'add', value: 1 }) }], 400)

    const tick = ticksUntil(run, (events) => events.some((event) => event.type === 'gateTaken'))

    expect(Math.abs(tick - 300)).toBeLessThanOrEqual(1)
  })

  it('wall_barrel_and_buff_block_on_level_15_stand_at_their_z_times_1_98_and_keep_their_x_and_width', () => {
    const run = runOn(15, [
      { type: 'barrel', z: 100, x: 2 },
      { type: 'wall', z: 160, x: -2.5, width: 5 },
      { type: 'buffBlock', z: 200, lane: 'right', hp: 40, buff: 'add' },
    ])

    expect(run.state.barrels.map(({ x, z }) => ({ x, z: z.toFixed(6) }))).toEqual([{ x: 2, z: (198).toFixed(6) }])
    expect(run.state.walls.map(({ x, width, z }) => ({ x, width, z: z.toFixed(6) }))).toEqual([{ x: -2.5, width: 5, z: (316.8).toFixed(6) }])
    expect(run.state.buffBlocks.map(({ lane, z }) => ({ lane, z: z.toFixed(6) }))).toEqual([{ lane: 'right', z: (396).toFixed(6) }])
  })

  // The example from docs/domain/run.md: length 400 takes 400 ÷ 12 ≈ 33 s on level 1 and 792 ÷ 23.76 ≈ 33 s on level 15.
  it.each([1, 15, 25])('level_%i_with_length_400_is_won_after_33_and_a_third_seconds', (level) => {
    const run = runOn(level, [], 400)

    stepTicks(run, 1998)
    expect(run.state.status).toBe('running')

    stepTicks(run, 3)
    expect(run.state.status).toBe('won')
  })

  it('finish_line_on_level_15_is_at_the_stretched_length', () => {
    const run = runOn(15, [], 400)

    stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('won')
    expect(run.state.squad.z).toBeGreaterThanOrEqual(792 - 1e-9)
    expect(run.state.squad.z).toBeLessThan(792 + level15Step + 1e-9)
  })
})

describe('waves on a faster level', () => {
  // The example from docs/domain/levels.md: a wave at z 80 appears at distance travelled 40 on level 1 and 79.2 on
  // level 15, both 3⅓ s into the run.
  it.each([
    [1, 40, 12 / 60],
    [15, 79.2, level15Step],
  ])('wave_at_z_80_on_level_%i_appears_at_distance_travelled_%d', (level, appearsAt, step) => {
    const run = runOn(level, [{ type: 'wave', z: 80, enemy: 'bulldog', pattern: 'column', count: 1, x: 0, spacing: 1 }])

    stepUntil(run, (state) => state.enemies.length > 0, 6000)

    expect(run.state.squad.z).toBeGreaterThanOrEqual(appearsAt - 1e-9)
    expect(run.state.squad.z).toBeLessThan(appearsAt + step + 1e-9)
  })

  it('wave_appears_in_the_tick_the_squad_is_exactly_the_spawn_distance_before_it', () => {
    // The wave stands 40 units beyond where an empty run's squad is after 153 ticks, a place 40 units can be taken from exactly.
    const emptyRun = runOn(1)
    stepTicks(emptyRun, 153)
    const appearsAt = emptyRun.state.squad.z
    expect(appearsAt + 40 - 40).toBe(appearsAt)
    const run = runOn(1, [{ type: 'wave', z: appearsAt + 40, enemy: 'bulldog', pattern: 'column', count: 1, x: 0, spacing: 1 }])

    stepTicks(run, 152)
    expect(run.state.enemies).toHaveLength(0)

    stepTicks(run, 1)
    expect(run.state.squad.z).toBe(appearsAt)
    expect(run.state.enemies).toHaveLength(1)
  })

  it('wave_appears_as_many_ticks_into_the_run_on_level_15_as_on_level_1', () => {
    const wave = { type: 'wave', z: 80, enemy: 'bulldog', pattern: 'column', count: 1, x: 0, spacing: 1 } as const
    const appeared = (run: Run) => {
      let ticks = 0
      stepUntil(run, (state) => state.enemies.length > 0 || (ticks++, false), 6000)
      return ticks
    }

    expect(Math.abs(appeared(runOn(15, [wave])) - appeared(runOn(1, [wave])))).toBeLessThanOrEqual(1)
  })

  // Rows stand spacing apart behind the stretched z; spacing itself is not stretched. The column grows with the level number,
  // so it has more than one row on level 15.
  it('wave_on_level_15_has_its_front_row_at_the_stretched_z_and_its_rows_spacing_apart', () => {
    const run = runOn(15, [{ type: 'wave', z: 80, enemy: 'bulldog', pattern: 'column', count: 2, x: 0, spacing: 1.5 }])

    stepUntil(run, (state) => state.enemies.length > 0, 6000)

    const zs = run.state.enemies.map((enemy) => enemy.z).sort((a, b) => a - b)
    expect(zs.length).toBeGreaterThan(1)
    // It may already have taken one step of 2.5/60 units in the tick it appeared.
    expect(Math.abs(zs[0] - 158.4)).toBeLessThanOrEqual(2.5 / 60 + 1e-9)
    zs.slice(1).forEach((z, index) => expect(z - zs[index]).toBeCloseTo(1.5, 6))
  })
})

describe('enemy stream on a faster level', () => {
  it.each([15, 25])('stream_enemy_on_level_%i_appears_79_2_units_ahead_of_the_squad_centre', (level) => {
    const run = runOn(level, [], 300, { interval: 0.25, enemies: ['bulldog'] })

    stepTicks(run, 15)

    expect(run.state.enemies).toHaveLength(1)
    // It may already have taken one step of 2.5/60 units in the tick it appeared.
    expect(Math.abs(run.state.enemies[0].z - (run.state.squad.z + 79.2))).toBeLessThanOrEqual(2.5 / 60 + 1e-9)
  })

  // Times are not stretched: an interval of 1.5 s is 90 ticks on every level.
  it('stream_on_level_15_sends_its_first_enemy_after_the_same_90_ticks', () => {
    const run = runOn(15, [], 300, { interval: 1.5, enemies: ['bulldog'] })

    stepTicks(run, 89)
    expect(run.state.enemies).toHaveLength(0)

    stepTicks(run, 1)
    expect(run.state.enemies).toHaveLength(1)
  })

  // A squad of 999 outlasts the puppies; a stream enemy more than 70 units ahead has just appeared.
  it('stream_on_level_15_runs_on_past_the_unstretched_length', () => {
    const run = runOn(15, doublingRows(10), 300, { interval: 1, enemies: ['puppy'] })
    let freshEnemyPastTheFileLength = false

    stepUntil(
      run,
      (state) => {
        if (state.squad.z > 400 && state.enemies.some((enemy) => enemy.z > state.squad.z + 70)) freshEnemyPastTheFileLength = true
        return false
      },
      6000,
    )

    expect(run.state.status).toBe('won')
    expect(freshEnemyPastTheFileLength).toBe(true)
  })

  it('stream_on_level_15_stops_at_the_stretched_arena_start', () => {
    const run = createRun({
      level: bossLevelOf(doublingRows(10), { boss: 'dustbot', expectedSquadAtBoss: 100000, level: 15, stream: { interval: 0.25, enemies: ['puppy'] } }),
      seed: 1,
    })
    stepToArena(run)
    expect(run.state.squad.z).toBeCloseTo(594, 6)

    // Enemies already alive may die, but none appears.
    let alive = run.state.enemies.length
    for (let tick = 0; tick < 120; tick++) {
      run.step(noSteering)
      expect(run.state.enemies.length).toBeLessThanOrEqual(alive)
      alive = run.state.enemies.length
    }
  })
})

describe('what does not stretch', () => {
  it.each([
    ['puppy', 4],
    ['bulldog', 2.5],
  ] as const)('%s_on_level_15_runs_toward_the_squad_at_its_own_speed', (enemy, speed) => {
    const run = runOn(15, [{ type: 'wave', z: 80, enemy, pattern: 'column', count: 1, x: 4, spacing: 1 }])
    stepUntil(run, (state) => state.enemies.length > 0, 6000)
    const start = { ...run.state.enemies.reduce((nearest, next) => (next.z < nearest.z ? next : nearest)) }
    const squadStart = run.state.squad.z

    stepTicks(run, 30)

    const nearest = run.state.enemies.reduce((first, next) => (next.z < first.z ? next : first))
    expect(nearest.z).toBeCloseTo(start.z - speed / 2, 6)
    // Across the track at the chase speed of 6 units/s.
    expect(nearest.x).toBeCloseTo(start.x - 3, 6)
    // So it closes in at the level speed plus its own speed: 27.76 units/s for a puppy.
    expect(start.z - squadStart - (nearest.z - run.state.squad.z)).toBeCloseTo((level15Speed + speed) / 2, 6)
  })

  it('holding_a_steering_key_on_level_15_moves_the_steering_point_12_units_per_second', () => {
    const run = runOn(15)

    stepTicks(run, 15, { ...noSteering, right: true })

    expect(run.state.squad.steeringPoint).toBeCloseTo(3, 6)
  })

  it('steering_point_on_level_15_is_clamped_to_the_track_edge', () => {
    const run = runOn(15)

    run.step({ ...noSteering, drag: 20 })

    expect(run.state.squad.steeringPoint).toBe(5)
  })

  it('squad_on_level_15_closes_the_gap_to_the_steering_point_in_about_80_ms', () => {
    const run = runOn(15)

    run.step({ ...noSteering, drag: 4 })
    stepTicks(run, 2)
    expect(run.state.squad.x).toBeLessThan(3.8)

    stepTicks(run, 9)
    expect(run.state.squad.x).toBeGreaterThan(3.8)
    expect(run.state.squad.x).toBeLessThanOrEqual(4)
  })

  it('squad_in_the_left_lane_on_level_15_takes_the_left_gate', () => {
    const run = runOn(15, [{ type: 'gates', z: 60, left: { op: 'add', value: 5 }, centre: { op: 'add', value: 1 }, right: { op: 'add', value: 2 } }])
    steerTo(run, -10 / 3)

    stepUntil(run, (state) => state.squad.z > 120, 6000)

    expect(run.state.squad.count).toBe(6)
  })

  // A wall over x −5..0 at z 60 reaches from 118.8 to 119.8 on level 15, not to 118.8 + 1.98.
  it('squad_centre_steered_into_a_wall_on_level_15_while_it_passes_loses_the_run', () => {
    const run = runOn(15, [{ type: 'wall', z: 60, x: -2.5, width: 5 }])
    steerTo(run, 0.5)
    stepUntil(run, (state) => state.squad.z >= 118.8 + 0.2, 6000)
    expect(run.state.status).toBe('running')

    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.z > 119.8, 6000)

    expect(run.state.lossCause).toBe('ranIntoWall')
  })

  it('wall_on_level_15_is_still_1_unit_deep', () => {
    const run = runOn(15, [{ type: 'wall', z: 60, x: -2.5, width: 5 }])
    steerTo(run, 0.5)
    stepUntil(run, (state) => state.squad.z > 119.8 + 0.01, 6000)

    // One tick moves the squad's centre past x = 0 while the squad is within 118.8 + 1.98 = 120.78.
    steerTo(run, -2.5)
    expect(run.state.squad.x).toBeLessThanOrEqual(0)
    expect(run.state.squad.z).toBeLessThan(120.78)
    stepUntil(run, (state) => state.squad.z > 125, 6000)

    expect(run.state.status).toBe('running')
  })

  it('buff_block_on_level_15_is_still_1_unit_deep', () => {
    const run = runOn(15, [{ type: 'buffBlock', z: 60, lane: 'left', hp: 1_000_000, buff: 'add' }])
    stepUntil(run, (state) => state.squad.z > 119.8 + 0.01, 6000)

    steerTo(run, -5)
    expect(run.state.squad.x).toBeLessThan(-5 / 3)
    expect(run.state.squad.z).toBeLessThan(120.78)
    stepUntil(run, (state) => state.squad.z > 125, 6000)

    expect(run.state.status).toBe('running')
  })
})

describe('boss arena on a faster level', () => {
  // The arena start is stretched; the boss start distance of 35 and the walk speed of 1.5 units/s are not.
  it('mega_dustbot_on_level_15_enters_35_units_beyond_the_stretched_arena_start', () => {
    const run = createRun({ level: bossLevelOf([], { boss: 'megaDustbot', expectedSquadAtBoss: 100000, level: 15 }), seed: 1 })

    stepToArena(run)

    expect(run.state.squad.z).toBeCloseTo(594, 6)
    expect(run.state.boss?.x).toBe(0)
    expect(run.state.boss?.z).toBeLessThanOrEqual(594 + 35 + 1e-9)
    expect(run.state.boss?.z).toBeGreaterThanOrEqual(594 + 35 - 1.5 / 60 - 1e-9)
  })

  it('squad_on_level_15_stops_at_the_stretched_arena_start', () => {
    const run = createRun({ level: bossLevelOf([], { boss: 'megaDustbot', expectedSquadAtBoss: 100000, level: 15 }), seed: 1 })
    stepToArena(run)
    const arenaStart = run.state.squad.z

    stepTicks(run, 60)

    expect(run.state.squad.z).toBe(arenaStart)
  })

  it('mega_dustbot_on_level_15_walks_1_5_units_per_second', () => {
    const run = createRun({ level: bossLevelOf([], { boss: 'megaDustbot', expectedSquadAtBoss: 100000, level: 15 }), seed: 1 })
    stepToArena(run)
    const start = run.state.boss?.z ?? Number.NaN

    stepTicks(run, 60)

    expect(run.state.boss?.z).toBeCloseTo(start - 1.5, 6)
  })

  it('mega_dustbot_on_level_15_throws_a_dust_ball_every_3_seconds', () => {
    const run = createRun({ level: bossLevelOf(doublingRows(6), { boss: 'megaDustbot', expectedSquadAtBoss: 100000, level: 15 }), seed: 1 })
    stepToArena(run)
    const thrown: number[] = []

    for (let tick = 1; tick <= 400 && run.state.status === 'running'; tick++) {
      if (run.step(noSteering).some((event) => event.type === 'dustBallThrown')) thrown.push(tick)
    }

    expect(thrown).toHaveLength(2)
    thrown.forEach((tick, index) => expect(Math.abs(tick - 180 * (index + 1))).toBeLessThanOrEqual(1))
  })

  // Boss HP follows the expected squad at boss, not the level speed: 60 × 2 × 20 = 2,400.
  it('mega_dustbot_on_level_15_has_the_boss_hp_of_its_expected_squad', () => {
    const run = createRun({ level: bossLevelOf([], { boss: 'megaDustbot', expectedSquadAtBoss: 60, level: 15 }), seed: 1 })

    stepToArena(run)

    expect(run.state.boss?.fullHp).toBe(2400)
  })
})

describe('yarn balls on a faster level', () => {
  // The example from docs/domain/run.md: on level 15 a yarn ball moves along the road at 30 + 23.76 − 12 = 41.76 units/s,
  // and so pulls away from the squad at 18 units/s, as on level 1.
  it('yarn_ball_on_level_15_moves_along_the_road_at_41_76_units_per_second', () => {
    const run = runOn(15)
    stepUntil(run, (state) => state.yarnBalls.length > 0, 120)
    const fired = { ...run.state.yarnBalls[0] }

    stepTicks(run, 10)

    expect(run.state.yarnBalls[0].z - fired.z).toBeCloseTo(41.76 / 6, 6)
    expect(run.state.yarnBalls[0].x).toBe(fired.x)
  })

  it.each([1, 2, 15])('yarn_ball_on_level_%i_pulls_away_from_the_squad_at_18_units_per_second', (level) => {
    const run = runOn(level)
    stepUntil(run, (state) => state.yarnBalls.length > 0, 120)
    const gapAtFiring = run.state.yarnBalls[0].z - run.state.squad.z

    stepTicks(run, 20)

    expect(run.state.yarnBalls[0].z - run.state.squad.z - gapAtFiring).toBeCloseTo(6, 6)
  })

  // The road's carry does not count toward the range: the yarn ball still flies 1 s, so 41.76 units along the road.
  it('yarn_ball_on_level_15_vanishes_after_its_1_second_flight', () => {
    const run = runOn(15)
    stepUntil(run, (state) => state.yarnBalls.length > 0, 120)
    const firedAtZ = run.state.cats[0].z

    let flown = 0
    for (let tick = 0; tick < 120; tick++) {
      run.step(noSteering)
      const farthestZ = Math.max(...run.state.yarnBalls.map((yarnBall) => yarnBall.z))
      if (farthestZ - firedAtZ < flown) break
      flown = farthestZ - firedAtZ
    }

    expect(flown).toBeLessThanOrEqual(41.76 + 1e-9)
    expect(flown).toBeGreaterThanOrEqual(41.76 - 41.76 / 60 - 1e-9)
  })

  // A multi-shot gate gives 2 yarn balls at −2.5° and +2.5°; the carry is straight along the road, so it adds to z only.
  it('fanned_yarn_ball_on_level_15_drifts_sideways_as_on_level_1', () => {
    const run = runOn(15, [{ type: 'gates', z: 5, ...everyLane({ op: 'multiShot', value: 1 }) }])
    stepUntil(run, (state) => state.weapon.yarnBallsPerShot === 2, 120)
    stepToNextShot(run)
    const shot = run.state.yarnBalls.filter((yarnBall) => yarnBall.z < Math.min(...run.state.yarnBalls.map((other) => other.z)) + 0.1)
    expect(shot).toHaveLength(2)
    const rightmost = { ...shot.reduce((first, next) => (next.x > first.x ? next : first)) }

    stepTicks(run, 10)

    const sameBall = run.state.yarnBalls.find((yarnBall) => Math.abs(yarnBall.x - rightmost.x - 5 * Math.sin((2.5 * Math.PI) / 180)) < 1e-6)
    expect(sameBall).toBeDefined()
    expect((sameBall?.z ?? Number.NaN) - rightmost.z).toBeCloseTo(5 * Math.cos((2.5 * Math.PI) / 180) + 11.76 / 6, 6)
  })

  it('yarn_ball_in_the_arena_on_level_15_flies_30_units_per_second', () => {
    const run = createRun({ level: bossLevelOf([], { boss: 'dustbot', expectedSquadAtBoss: 100000, level: 15 }), seed: 1 })
    stepToArena(run)
    stepToNextShot(run)
    const newest = Math.min(...run.state.yarnBalls.map((yarnBall) => yarnBall.z))

    stepTicks(run, 10)

    expect(Math.min(...run.state.yarnBalls.map((yarnBall) => yarnBall.z)) - newest).toBeCloseTo(5, 6)
  })

  it('yarn_balls_in_flight_when_the_road_stops_lose_their_carry_from_then_on', () => {
    const run = createRun({ level: bossLevelOf([], { boss: 'dustbot', expectedSquadAtBoss: 100000, level: 15 }), seed: 1 })
    stepToArena(run)

    // Every yarn ball still in flight a tick later stands 0.5 units further along; a new one stands at the cats.
    let followed = 0
    for (let tick = 0; tick < 30; tick++) {
      const before = run.state.yarnBalls.map((yarnBall) => yarnBall.z)
      run.step(noSteering)
      for (const yarnBall of run.state.yarnBalls) {
        if (yarnBall.z < run.state.squad.z + 1) continue
        followed++
        expect(before.some((z) => Math.abs(yarnBall.z - z - 0.5) < 1e-6)).toBe(true)
      }
    }

    expect(followed).toBeGreaterThan(30)
  })
})
