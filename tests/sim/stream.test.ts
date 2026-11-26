import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type EnemyState, type Run } from '../../src/sim/run'
import { bossLevelOf, doublingRows, levelOf, noSteering, stepTicks, stepToArena, stepUntil } from './runHarness'

type Stream = Level['stream']

function streamRun(stream: Stream, { level = 1, events = [], seed = 1 }: { level?: number; events?: Level['events']; seed?: number } = {}): Run {
  return createRun({ level: levelOf(events, 300, level, stream), seed })
}

// Steps tick by tick, counting the run's first tick as tick 1, and lists every enemy that appeared in a tick, by that tick.
// Bulldogs and shield dogs outlast the shots of 1 cat for the first seconds, so no enemy dies while one appears.
function spawnsUpTo(run: Run, lastTick: number) {
  const spawns: { tick: number; enemy: EnemyState; squadZ: number }[] = []
  for (let tick = 1; tick <= lastTick && run.state.status === 'running'; tick++) {
    const before = run.state.enemies.length
    run.step(noSteering)
    const newest = [...run.state.enemies].sort((a, b) => b.z - a.z).slice(0, run.state.enemies.length - before)
    for (const enemy of newest) spawns.push({ tick, enemy: { ...enemy }, squadZ: run.state.squad.z })
  }
  return spawns
}

describe('stream timing', () => {
  it('stream_sends_its_first_enemy_one_interval_into_the_run', () => {
    // The example from docs/domain/run.md: an interval of 1.5 s is 90 ticks.
    const run = streamRun({ interval: 1.5, enemies: ['bulldog'] })

    stepTicks(run, 89)
    expect(run.state.enemies).toHaveLength(0)

    stepTicks(run, 1)
    expect(run.state.enemies).toHaveLength(1)
  })

  it('stream_sends_one_enemy_on_every_whole_multiple_of_the_interval', () => {
    const run = streamRun({ interval: 0.25, enemies: ['bulldog'] })

    const spawns = spawnsUpTo(run, 120)

    expect(spawns.map((spawn) => spawn.tick)).toEqual([15, 30, 45, 60, 75, 90, 105, 120])
  })

  it.each([
    ['half_a_tick_rounds_up', 0.125, [8, 16, 24]],
    ['a_whole_number_of_ticks_stays', 0.1, [6, 12, 18]],
    ['less_than_half_a_tick_is_still_1_tick', 0.004, [1, 2, 3]],
  ])('stream_interval_of_%s', (_case, interval, ticks) => {
    const run = streamRun({ interval, enemies: ['bulldog'] })

    const spawns = spawnsUpTo(run, ticks[2])

    expect(spawns.map((spawn) => spawn.tick)).toEqual(ticks)
  })

  it('stream_sends_its_enemies_in_order_and_starts_over_after_the_last', () => {
    // The example from docs/domain/run.md, with shield dogs and bulldogs that 1 cat does not shoot down at once.
    const run = streamRun({ interval: 0.25, enemies: ['shieldDog', 'shieldDog', 'bulldog'] })

    const spawns = spawnsUpTo(run, 90)

    expect(spawns.map((spawn) => spawn.enemy.kind)).toEqual(['shieldDog', 'shieldDog', 'bulldog', 'shieldDog', 'shieldDog', 'bulldog'])
  })
})

describe('stream enemies', () => {
  it('stream_enemy_appears_40_units_ahead_of_the_squad_centre', () => {
    const run = streamRun({ interval: 0.25, enemies: ['bulldog'] })

    const spawns = spawnsUpTo(run, 60)

    expect(spawns).toHaveLength(4)
    // It may already have taken one step of 2.5/60 units in the tick it appeared.
    for (const { enemy, squadZ } of spawns) expect(Math.abs(enemy.z - (squadZ + 40))).toBeLessThanOrEqual(2.5 / 60 + 1e-9)
  })

  it('stream_enemies_appear_at_x_drawn_evenly_across_the_track', () => {
    // One bulldog a tick for 100 ticks. Each may already have moved up to 0.1 across in the tick it appeared, towards the
    // squad's centre at x = 0, which keeps it on the track.
    const run = streamRun({ interval: 1 / 60, enemies: ['bulldog'] })

    const xs = spawnsUpTo(run, 100).map((spawn) => spawn.enemy.x)

    expect(xs).toHaveLength(100)
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(-5)
      expect(x).toBeLessThanOrEqual(5)
    }
    // 25 expected in each quarter of the track.
    for (const [from, to] of [
      [-5, -2.5],
      [-2.5, 0],
      [0, 2.5],
      [2.5, 5],
    ]) {
      expect(xs.filter((x) => x >= from && x < to).length).toBeGreaterThanOrEqual(10)
    }
    expect(new Set(xs).size).toBe(100)
  })

  it('stream_enemy_on_level_3_has_the_scaled_hp_of_a_wave_enemy', () => {
    // docs/domain/levels.md: a puppy has 3 × 1.08² = 3.4992 HP on level 3.
    const run = streamRun({ interval: 0.25, enemies: ['puppy'] }, { level: 3 })

    const [spawn] = spawnsUpTo(run, 15)

    expect(spawn.enemy.hp).toBeCloseTo(3.4992, 9)
  })

  it('stream_shield_dog_on_level_2_has_its_shield_and_body_times_1_08', () => {
    const run = streamRun({ interval: 0.25, enemies: ['shieldDog'] }, { level: 2 })

    const [spawn] = spawnsUpTo(run, 15)

    expect(spawn.enemy.shield).toBeCloseTo(32.4, 9)
    expect(spawn.enemy.hp).toBeCloseTo(16.2, 9)
  })

  // requirements S-12 (7): the new dogs may come in the stream, with their HP scaled by the level number.
  it.each([
    ['greyhound', 16, 2 * 1.08 ** 15],
    ['dalmatian', 21, 12 * 1.08 ** 20],
  ] as const)('stream_sends_%ss_with_the_scaled_hp_of_level_%i', (enemy, level, hp) => {
    const run = streamRun({ interval: 0.25, enemies: ['bulldog', enemy] }, { level })

    const spawns = spawnsUpTo(run, 30)

    expect(spawns.map((spawn) => spawn.enemy.kind)).toEqual(['bulldog', enemy])
    expect(spawns[1].enemy.hp).toBeCloseTo(hp, 9)
  })

  it('stream_enemy_chases_the_squad_and_touches_it', () => {
    // A bulldog outlasts the shots of 1 cat, so the squad of 1 is lost to it.
    const run = streamRun({ interval: 0.25, enemies: ['bulldog'] })

    const events = stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('outOfCats')
    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([expect.objectContaining({ enemy: 'bulldog', cause: 'contact' })])
  })
})

describe('stream end', () => {
  it('stream_stops_at_the_arena_start', () => {
    // 256 cats shoot down the puppies and outlast the boss for the few seconds watched.
    const fresh = (run: Run) => run.state.enemies.some((enemy) => enemy.z > run.state.squad.z + 39)
    const run = createRun({
      level: bossLevelOf(doublingRows(8), { boss: 'dustbot', expectedSquadAtBoss: 999, stream: { interval: 0.5, enemies: ['puppy'] } }),
      seed: 1,
    })
    let freshBeforeTheArena = 0

    stepToArena(run, 6000, () => {
      if (run.state.squad.z > 250 && fresh(run)) freshBeforeTheArena++
      return noSteering
    })
    expect(run.state.boss).not.toBeNull()
    expect(freshBeforeTheArena).toBeGreaterThan(0)

    // A puppy that appeared just before the arena start is no longer fresh after 0.25 s at 4 units/s.
    stepTicks(run, 15)
    let freshInTheArena = 0
    stepUntil(
      run,
      () => {
        if (fresh(run)) freshInTheArena++
        return false
      },
      180,
    )

    expect(run.state.status).toBe('running')
    expect(freshInTheArena).toBe(0)
  })
})

describe('enemy cap with the stream', () => {
  // One bulldog a tick reaches 150 alive on tick 150, about a second before the first of them reaches the squad.
  it('stream_enemy_that_would_spawn_while_150_are_alive_is_dropped', () => {
    const run = streamRun({ interval: 1 / 60, enemies: ['bulldog'] })
    stepTicks(run, 150)
    expect(run.state.enemies).toHaveLength(150)

    for (let tick = 151; tick <= 160; tick++) {
      run.step(noSteering)
      expect(run.state.enemies).toHaveLength(150)
    }

    // No new bulldog took a place: the newest is 10 ticks old, and the oldest, from tick 1, is still there.
    const ahead = run.state.enemies.map((enemy) => enemy.z - run.state.squad.z)
    expect(Math.max(...ahead)).toBeCloseTo(40 - (10 * (12 + 2.5)) / 60, 1)
    expect(Math.min(...ahead)).toBeCloseTo(40 - (159 * (12 + 2.5)) / 60, 1)
  })
})
