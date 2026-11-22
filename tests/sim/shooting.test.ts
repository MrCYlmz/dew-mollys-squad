import { describe, expect, it } from 'vitest'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { copied, levelOf, noSteering, repeatedRows, steerTo, stepTicks, stepUntil } from './runHarness'

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

  // A yarn ball lives range / speed = 1 s, so at 2 shots/s about 2 are in flight per cat.
  // The tolerance allows a tick either way on each yarn ball's lifetime and shot timing.
  it('one_cat_fires_2_yarn_balls_per_second_that_vanish_at_the_end_of_their_range', () => {
    const run = createRun({ level: levelOf([]), seed: 1 })
    stepTicks(run, 120)

    expect(Math.abs(averageYarnBallsInFlight(run, 120) - 2)).toBeLessThanOrEqual(0.2)
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

    expect(Math.abs(averageYarnBallsInFlight(run, 120) - 4)).toBeLessThanOrEqual(0.4)
  })

  it('yarn_ball_vanishes_once_it_has_flown_its_30_unit_range', () => {
    const run = createRun({ level: levelOf([]), seed: 1 })
    stepUntil(run, (state) => state.yarnBalls.length > 0, 120)
    // The only cat fired it from where it stands this tick.
    const firedAtZ = run.state.cats[0].z

    // The first yarn ball stays the farthest one until it vanishes.
    let flown = 0
    for (let tick = 0; tick < 120; tick++) {
      run.step(noSteering)
      const farthestZ = Math.max(...run.state.yarnBalls.map((yarnBall) => yarnBall.z))
      if (farthestZ - firedAtZ < flown) break
      flown = farthestZ - firedAtZ
    }

    expect(flown).toBeLessThanOrEqual(30 + 1e-9)
    expect(flown).toBeGreaterThanOrEqual(29.5)
  })

  it('yarn_ball_deals_1_damage_to_the_puppy_it_hits', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 60, enemy: 'puppy', pattern: 'line', count: 1 }]),
      seed: 1,
    })
    stepUntil(run, (state) => state.enemies.length > 0, 600)
    const hpSeen = [run.state.enemies[0].hp]
    const events: GameEvent[] = []

    while (run.state.enemies.length > 0 && run.state.status === 'running') {
      events.push(...copied(run.step(noSteering)))
      const hp = run.state.enemies[0]?.hp
      if (hp !== undefined && hp !== hpSeen[hpSeen.length - 1]) hpSeen.push(hp)
    }

    expect(hpSeen).toEqual([3, 2, 1])
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemyKilled', cause: 'shot' }))
    expect(run.state.squad.count).toBe(1)
  })

  it('yarn_ball_stops_at_the_first_puppy_it_hits', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 60, enemy: 'puppy', pattern: 'column', count: 3, x: 0, spacing: 2 }]),
      seed: 1,
    })
    stepUntil(run, (state) => state.enemies.length > 0, 600)

    let damagedPuppiesBehindTheFront = 0
    while (run.state.enemies.length > 0 && run.state.status === 'running') {
      run.step(noSteering)
      const nearestFirst = [...run.state.enemies].sort((a, b) => a.z - b.z)
      damagedPuppiesBehindTheFront += nearestFirst.slice(1).filter((puppy) => puppy.hp < 3).length
    }

    expect(damagedPuppiesBehindTheFront).toBe(0)
  })

  it('yarn_balls_miss_a_puppy_outside_the_lane_they_fly_in', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 60, enemy: 'puppy', pattern: 'column', count: 1, x: 2.5, spacing: 1 }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    let hpSeen = 3
    while (run.state.squad.z < 60 && run.state.status === 'running') {
      run.step(noSteering)
      for (const puppy of run.state.enemies) hpSeen = Math.min(hpSeen, puppy.hp)
    }

    expect(hpSeen).toBe(3)
  })

  it('yarn_ball_stops_at_the_nearer_of_two_close_puppies', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 60, enemy: 'puppy', pattern: 'column', count: 2, x: 0, spacing: 0.25 }]),
      seed: 1,
    })
    stepUntil(run, (state) => state.enemies.length > 0, 600)

    let backPuppyHitWhileFrontStood = false
    while (run.state.enemies.length === 2 && run.state.status === 'running') {
      run.step(noSteering)
      const [, back] = [...run.state.enemies].sort((a, b) => a.z - b.z)
      if (back !== undefined && back.hp < 3) backPuppyHitWhileFrontStood = true
    }

    expect(backPuppyHitWhileFrontStood).toBe(false)
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
    const puppyInLane = () => run.state.enemies.find((puppy) => puppy.x < 0)

    stepUntil(run, (state) => state.gateRows[0].taken !== null, 600)
    expect(puppyInLane()?.hp).toBe(3)

    stepUntil(run, () => (puppyInLane()?.hp ?? 0) < 3, 120)
    expect(puppyInLane()?.hp ?? 0).toBeLessThan(3)
  })

  it('yarn_balls_from_beyond_the_track_edge_pass_a_gate_row', () => {
    // 16 cats at the right edge: the outer ones stand beyond x = 5
    const run = createRun({
      level: levelOf([
        ...repeatedRows({ op: 'multiply', value: 2 }, 4),
        { type: 'gates', z: 60, left: { op: 'add', value: 1 }, right: { op: 'add', value: 1 } },
      ]),
      seed: 1,
    })
    steerTo(run, 5)
    let offTrackPastTheRow = 0
    let onTrackPastTheRow = 0

    // While every cat is behind the row, a yarn ball beyond it has flown through it.
    while (Math.max(...run.state.cats.map((cat) => cat.z)) < 59.5 && run.state.status === 'running') {
      run.step(noSteering)
      for (const yarnBall of run.state.yarnBalls) {
        if (yarnBall.z <= 60) continue
        if (Math.abs(yarnBall.x) > 5) offTrackPastTheRow++
        else onTrackPastTheRow++
      }
    }

    expect(run.state.squad.count).toBe(16)
    expect(Math.max(...run.state.cats.map((cat) => cat.x))).toBeGreaterThan(5)
    expect(offTrackPastTheRow).toBeGreaterThan(0)
    expect(onTrackPastTheRow).toBe(0)
  })
})
