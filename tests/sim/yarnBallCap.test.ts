import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type Run } from '../../src/sim/run'
import { doublingRows, levelOf, noSteering, stepTicks, stepUntil } from './runHarness'

function yarnBallsInFlightPerTick(run: Run, ticks: number): number[] {
  const inFlight: number[] = []
  for (let tick = 0; tick < ticks && run.state.status === 'running'; tick++) {
    run.step(noSteering)
    inFlight.push(run.state.yarnBalls.length)
  }
  return inFlight
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

// At 2 yarn balls/s and a 1 s flight, a squad of n cats would have 2n yarn balls in flight.
describe('yarn ball cap', () => {
  it('squad_of_999_never_has_more_than_400_yarn_balls_in_flight', () => {
    const run = createRun({ level: levelOf(doublingRows(10)), seed: 1 })

    const inFlight = yarnBallsInFlightPerTick(run, 1200)

    expect(run.state.squad.count).toBe(999)
    expect(Math.max(...inFlight)).toBeLessThanOrEqual(400)
  })

  it('squad_of_999_has_about_400_yarn_balls_in_flight', () => {
    // 1,998 would be in flight, so each yarn ball stands for 5 cats: about 400
    const run = createRun({ level: levelOf(doublingRows(10)), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 101, 6000)
    stepTicks(run, 120)

    const inFlight = yarnBallsInFlightPerTick(run, 120)

    expect(average(inFlight)).toBeGreaterThanOrEqual(360)
    expect(average(inFlight)).toBeLessThanOrEqual(400)
  })

  it('squad_of_200_fires_one_yarn_ball_per_cat', () => {
    // 1 cat lands fewer than 10 hits on the +99 gates, so they stay +99: 1 + 99 = 100, then ×2
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 10, left: { op: 'add', value: 99 }, right: { op: 'add', value: 99 } },
        { type: 'gates', z: 20, left: { op: 'multiply', value: 2 }, right: { op: 'multiply', value: 2 } },
      ]),
      seed: 1,
    })
    stepUntil(run, (state) => state.squad.z > 21, 6000)
    expect(run.state.squad.count).toBe(200)
    stepTicks(run, 120)

    const inFlight = yarnBallsInFlightPerTick(run, 120)

    expect(Math.max(...inFlight)).toBeLessThanOrEqual(400)
    expect(average(inFlight)).toBeGreaterThanOrEqual(380)
  })

  it('yarn_ball_standing_for_2_cats_takes_2_hp_per_hit', () => {
    // 512 would be in flight, so each yarn ball stands for 2 cats and a puppy goes 3 → 1 → killed
    const wave: Level['events'][number] = { type: 'wave', z: 150, enemy: 'puppy', pattern: 'line', count: 5 }
    const run = createRun({ level: levelOf([...doublingRows(8), wave]), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 81, 6000)
    expect(run.state.squad.count).toBe(256)

    const hpSeen = new Set<number>()
    while (run.state.squad.z < 150 && run.state.status === 'running') {
      run.step(noSteering)
      for (const puppy of run.state.puppies) hpSeen.add(puppy.hp)
    }

    expect(hpSeen.has(3)).toBe(true)
    expect([...hpSeen].filter((hp) => hp !== 3 && hp !== 1)).toEqual([])
  })

  it('yarn_ball_standing_for_3_cats_kills_a_3_hp_puppy_with_one_hit', () => {
    // 1,024 would be in flight, so each yarn ball stands for 3 cats and deals 3 damage
    const wave: Level['events'][number] = { type: 'wave', z: 200, enemy: 'puppy', pattern: 'line', count: 5 }
    const run = createRun({ level: levelOf([...doublingRows(9), wave]), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 91, 6000)
    expect(run.state.squad.count).toBe(512)

    const hpSeen = new Set<number>()
    let shotKills = 0
    while (run.state.squad.z < 200 && run.state.status === 'running') {
      const events = run.step(noSteering)
      shotKills += events.filter((event) => event.type === 'puppyKilled' && event.cause === 'shot').length
      for (const puppy of run.state.puppies) hpSeen.add(puppy.hp)
    }

    expect(shotKills).toBeGreaterThan(0)
    expect([...hpSeen]).toEqual([3])
  })

  it('yarn_ball_standing_for_3_cats_counts_as_3_hits_on_a_gate', () => {
    // 1,024 would be in flight, so each yarn ball stands for 3 cats. 512 cats land about
    // 512 × 2 × 3.75 = 3,840 hits, so about 384 steps, the same as every cat firing its own.
    const run = createRun({
      level: levelOf([
        ...doublingRows(9),
        { type: 'gates', z: 200, left: { op: 'add', value: 1 }, right: { op: 'add', value: 1 } },
      ]),
      seed: 1,
    })
    stepUntil(run, (state) => state.squad.z > 91, 6000)
    expect(run.state.squad.count).toBe(512)

    stepUntil(run, (state) => state.squad.z > 201, 6000)
    const row = run.state.gateRows[9]
    const steps = row.left.value - 1 + (row.right.value - 1)

    expect(steps).toBeGreaterThanOrEqual(384 * 0.85)
    expect(steps).toBeLessThanOrEqual(384 * 1.15)
  })

  it('gate_carries_spare_hits_over_to_its_next_step', () => {
    // 256 cats fire yarn balls of 2 hits and 512 cats yarn balls of 3 hits, which leave spare
    // hits past each 10. With the spare hits kept, twice the cats raise the gate twice as far.
    const stepsFrom = (doublings: number) => {
      const run = createRun({
        level: levelOf([
          ...doublingRows(doublings),
          { type: 'gates', z: 200, left: { op: 'add', value: 1 }, right: { op: 'add', value: 1 } },
        ]),
        seed: 1,
      })
      stepUntil(run, (state) => state.squad.z > 201, 6000)
      const row = run.state.gateRows[doublings]
      return row.left.value - 1 + (row.right.value - 1)
    }

    const ratio = stepsFrom(9) / stepsFrom(8)

    expect(ratio).toBeGreaterThanOrEqual(1.84)
    expect(ratio).toBeLessThanOrEqual(2.16)
  })
})
