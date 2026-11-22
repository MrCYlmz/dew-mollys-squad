import { describe, expect, it } from 'vitest'
import type { BossKind, Level } from '../../src/content/level'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { bossLevelOf, copied, doublingRows, noSteering, steerTo, stepTicks, stepToArena } from './runHarness'

// Values from docs/domain/run.md (Dust balls).
const throwInterval = 180
const dustBallStep = 10 / 60
// An HP no squad in these tests can shoot down.
const unbeatable = 100000

function bossRun(boss: BossKind, events: Level['events']): Run {
  return createRun({ level: bossLevelOf(events, { boss, expectedSquadAtBoss: unbeatable }), seed: 1 })
}

// Ticks after the boss entered at which a dust ball was thrown.
function throwTicks(run: Run, ticks: number): number[] {
  const thrown: number[] = []
  for (let tick = 1; tick <= ticks && run.state.status === 'running'; tick++) {
    if (run.step(noSteering).some((event) => event.type === 'dustBallThrown')) thrown.push(tick)
  }
  return thrown
}

// Steps to the first throw after the boss entered; returns the events of that tick.
function stepToFirstThrow(run: Run): GameEvent[] {
  for (let tick = 0; tick < 400; tick++) {
    const events = copied(run.step(noSteering))
    if (events.some((event) => event.type === 'dustBallThrown')) return events
  }
  throw new Error('no dust ball thrown')
}

describe('dust balls', () => {
  it('dustbot_throws_no_dust_balls', () => {
    const run = bossRun('dustbot', doublingRows(6))
    stepToArena(run)

    for (let tick = 0; tick < 600; tick++) {
      expect(run.step(noSteering).filter((event) => event.type === 'dustBallThrown')).toEqual([])
      expect(run.state.dustBalls).toEqual([])
    }
  })

  it('mega_dustbot_throws_its_first_dust_ball_3_s_after_it_enters', () => {
    const run = bossRun('megaDustbot', doublingRows(6))
    stepToArena(run)
    expect(run.state.dustBalls).toEqual([])

    const thrown = throwTicks(run, 200)

    expect(thrown).toHaveLength(1)
    expect(Math.abs(thrown[0] - throwInterval)).toBeLessThanOrEqual(1)
  })

  it('mega_dustbot_throws_one_dust_ball_every_3_s', () => {
    const run = bossRun('megaDustbot', doublingRows(6))
    stepToArena(run)

    const thrown = throwTicks(run, 13 * 60)

    expect(thrown).toHaveLength(4)
    thrown.forEach((tick, index) => expect(Math.abs(tick - throwInterval * (index + 1))).toBeLessThanOrEqual(1))
  })

  it('dust_ball_flies_from_the_boss_centre_at_10_units_per_second_toward_where_the_squad_centre_was', () => {
    const run = bossRun('megaDustbot', doublingRows(2))
    steerTo(run, -3)
    stepToArena(run)
    stepToFirstThrow(run)
    const boss = { ...run.state.boss! }
    const aim = { x: run.state.squad.x, z: run.state.squad.z }
    expect(run.state.dustBalls).toHaveLength(1)
    // The squad steers away; the dust ball keeps to its line.
    steerTo(run, 3)
    const first = { ...run.state.dustBalls[0] }

    stepTicks(run, 30)

    const last = run.state.dustBalls[0]
    const flownX = last.x - first.x
    const flownZ = last.z - first.z
    const toAimX = aim.x - boss.x
    const toAimZ = aim.z - boss.z
    const toAim = Math.hypot(toAimX, toAimZ)
    expect(Math.hypot(flownX, flownZ)).toBeCloseTo(30 * dustBallStep, 6)
    expect(flownX / (30 * dustBallStep)).toBeCloseTo(toAimX / toAim, 2)
    expect(flownZ / (30 * dustBallStep)).toBeCloseTo(toAimZ / toAim, 2)
    // Its line starts at the boss's centre, as far as the boss moves in a tick.
    const offLine = Math.abs((first.x - boss.x) * toAimZ - (first.z - boss.z) * toAimX) / toAim
    expect(offLine).toBeLessThan(0.05)
  })

  it('dust_ball_touching_the_squad_costs_3_cats_and_disappears', () => {
    const run = bossRun('megaDustbot', doublingRows(2))
    stepToArena(run)
    stepToFirstThrow(run)
    const events: GameEvent[] = []
    let hitTickEvents: GameEvent[] = []
    let dustBallsBeforeHit = 0

    for (let tick = 0; tick < 240 && !hitTickEvents.some((event) => event.type === 'dustBallHit'); tick++) {
      dustBallsBeforeHit = run.state.dustBalls.length
      hitTickEvents = copied(run.step(noSteering))
      events.push(...hitTickEvents)
    }

    expect(events.filter((event) => event.type === 'dustBallHit')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: 3 }])
    expect(hitTickEvents).toContainEqual({ type: 'catsLost', count: 3 })
    expect(run.state.squad.count).toBe(1)
    expect(run.state.status).toBe('running')
    // The next dust ball may be thrown in the same tick.
    const thrownInHitTick = hitTickEvents.some((event) => event.type === 'dustBallThrown') ? 1 : 0
    expect(run.state.dustBalls).toHaveLength(dustBallsBeforeHit - 1 + thrownInHitTick)
  })

  it('dust_ball_that_takes_the_last_cats_loses_the_run', () => {
    const run = bossRun('megaDustbot', doublingRows(1))
    stepToArena(run)
    stepToFirstThrow(run)

    const events = stepTicks(run, 240)

    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: 2 }])
    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('outOfCats')
  })

  // The example from docs/domain/run.md: a squad that has steered 2 units aside by the time the dust ball arrives is missed.
  it('steering_2_units_aside_dodges_a_dust_ball', () => {
    const run = bossRun('megaDustbot', doublingRows(2))
    stepToArena(run)
    stepToFirstThrow(run)
    steerTo(run, 2)

    const events = stepTicks(run, 240)

    expect(events.filter((event) => event.type === 'dustBallHit')).toEqual([])
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([])
    expect(run.state.squad.count).toBe(4)
    // The dodged dust ball flew on past the last cat and disappeared; only the next one, still on its way, is left.
    for (const dustBall of run.state.dustBalls) expect(dustBall.z).toBeGreaterThan(run.state.squad.z)
  })

  it('yarn_balls_and_dust_balls_do_not_stop_each_other', () => {
    // The cats fire straight up the dust ball's line; 4 cats land about 8 hits a second on the boss.
    const run = bossRun('megaDustbot', doublingRows(2))
    stepToArena(run)
    stepToFirstThrow(run)
    const events: GameEvent[] = []

    for (let tick = 0; tick < 240 && !events.some((event) => event.type === 'dustBallHit'); tick++) {
      events.push(...copied(run.step(noSteering)))
    }

    expect(events.filter((event) => event.type === 'dustBallHit')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'bossHit').length).toBeGreaterThanOrEqual(18)
  })
})
