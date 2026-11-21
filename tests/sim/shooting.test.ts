import { describe, expect, it } from 'vitest'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { levelOf, noSteering, steerTo, stepTicks, stepUntil } from './runHarness'

function averageYarnBallsInFlight(run: Run, ticks: number): number {
  let total = 0
  for (let tick = 0; tick < ticks; tick++) {
    stepTicks(run, 1)
    total += run.state.yarnBalls.length
  }
  return total / ticks
}

describe('yarn balls', () => {
  it('yarn_ball_flies_straight_ahead_at_30_units_per_second', () => {
    const run = createRun({ level: levelOf([]), seed: 1 })
    stepUntil(run, (state) => state.yarnBalls.length > 0, 120)
    const fired = { ...run.state.yarnBalls[0] }

    stepTicks(run, 10)

    expect(run.state.yarnBalls[0].z - fired.z).toBeCloseTo(5, 6)
    expect(run.state.yarnBalls[0].x).toBe(fired.x)
  })

  // A yarn ball lives range / speed = 1 s, so at 3 shots/s about 3 are in flight per cat.
  // The tolerance allows a tick either way on each yarn ball's lifetime and shot timing.
  it('one_cat_fires_3_yarn_balls_per_second_that_vanish_at_the_end_of_their_range', () => {
    const run = createRun({ level: levelOf([]), seed: 1 })
    stepTicks(run, 120)

    expect(Math.abs(averageYarnBallsInFlight(run, 120) - 3)).toBeLessThanOrEqual(0.2)
  })

  it('every_cat_fires', () => {
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 2, left: { op: 'multiply', value: 2 }, right: { op: 'multiply', value: 2 } },
      ]),
      seed: 1,
    })
    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.count === 2, 60)
    stepTicks(run, 120)

    expect(Math.abs(averageYarnBallsInFlight(run, 120) - 6)).toBeLessThanOrEqual(0.4)
  })

  it('yarn_ball_deals_1_damage_to_the_puppy_it_hits', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 60, enemy: 'puppy', pattern: 'line', count: 1 }]),
      seed: 1,
    })
    stepUntil(run, (state) => state.puppies.length > 0, 600)
    const hpSeen = [run.state.puppies[0].hp]
    const events: GameEvent[] = []

    while (run.state.puppies.length > 0 && run.state.status === 'running') {
      events.push(...run.step(noSteering))
      const hp = run.state.puppies[0]?.hp
      if (hp !== undefined && hp !== hpSeen[hpSeen.length - 1]) hpSeen.push(hp)
    }

    expect(hpSeen).toEqual([3, 2, 1])
    expect(events).toContainEqual(expect.objectContaining({ type: 'puppyKilled', cause: 'shot' }))
    expect(run.state.squad.count).toBe(1)
  })

  it('yarn_ball_stops_at_the_first_puppy_it_hits', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 60, enemy: 'puppy', pattern: 'column', count: 3, x: 0, spacing: 2 }]),
      seed: 1,
    })
    stepUntil(run, (state) => state.puppies.length > 0, 600)

    let damagedPuppiesBehindTheFront = 0
    while (run.state.puppies.length > 0 && run.state.status === 'running') {
      run.step(noSteering)
      const nearestFirst = [...run.state.puppies].sort((a, b) => a.z - b.z)
      damagedPuppiesBehindTheFront += nearestFirst.slice(1).filter((puppy) => puppy.hp < 3).length
    }

    expect(damagedPuppiesBehindTheFront).toBe(0)
  })

  it('yarn_ball_stops_at_a_gate_in_front_of_a_puppy', () => {
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 20, left: { op: 'multiply', value: 2 }, right: { op: 'multiply', value: 2 } },
        { type: 'wave', z: 36, enemy: 'puppy', pattern: 'line', count: 2 },
      ]),
      seed: 1,
    })
    steerTo(run, -2.5)
    const puppyInLane = () => run.state.puppies.find((puppy) => puppy.x < 0)

    stepUntil(run, (state) => state.gateRows[0].taken !== null, 600)
    expect(puppyInLane()?.hp).toBe(3)

    stepUntil(run, () => (puppyInLane()?.hp ?? 0) < 3, 120)
    expect(puppyInLane()?.hp ?? 0).toBeLessThan(3)
  })
})
