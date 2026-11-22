import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type Run } from '../../src/sim/run'
import { doublingRows, levelOf, noSteering, repeatedRows, stepTicks, stepUntil } from './runHarness'

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
      for (const puppy of run.state.enemies) hpSeen.add(puppy.hp)
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
      shotKills += events.filter((event) => event.type === 'enemyKilled' && event.cause === 'shot').length
      for (const puppy of run.state.enemies) hpSeen.add(puppy.hp)
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

// Squads of exactly 100 or 200 cats: 1 cat lands fewer than 10 hits on the +99 gates, so they stay +99.
function hundredCats(): Level['events'] {
  return [{ type: 'gates', z: 10, left: { op: 'add', value: 99 }, right: { op: 'add', value: 99 } }]
}

function twoHundredCats(): Level['events'] {
  return [...hundredCats(), { type: 'gates', z: 15, left: { op: 'multiply', value: 2 }, right: { op: 'multiply', value: 2 } }]
}

describe('yarn ball cap with weapon buffs', () => {
  it('squad_of_100_with_one_multi_shot_gate_fires_every_yarn_ball', () => {
    // 100 cats × 2 yarn balls/s × 2 per shot × 1 s = 400 in flight, so N is still 1
    const run = createRun({ level: levelOf([...repeatedRows({ op: 'multiShot', value: 1 }, 1), ...hundredCats()]), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 11, 6000)
    expect(run.state.squad.count).toBe(100)
    stepTicks(run, 120)

    const inFlight = yarnBallsInFlightPerTick(run, 120)

    expect(Math.max(...inFlight)).toBeLessThanOrEqual(400)
    expect(average(inFlight)).toBeGreaterThanOrEqual(380)
  })

  it('squad_of_200_with_one_multi_shot_gate_never_has_more_than_400_yarn_balls_in_flight', () => {
    const run = createRun({ level: levelOf([...repeatedRows({ op: 'multiShot', value: 1 }, 1), ...twoHundredCats()]), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 16, 6000)
    expect(run.state.squad.count).toBe(200)

    const inFlight = yarnBallsInFlightPerTick(run, 240)

    expect(Math.max(...inFlight)).toBeLessThanOrEqual(400)
  })

  it('squad_of_200_with_one_multi_shot_gate_fires_yarn_balls_standing_for_2_cats', () => {
    // 800 would be in flight, so each yarn ball stands for 2 cats and a puppy goes 3 → 1 → killed
    const run = createRun({
      level: levelOf([
        ...repeatedRows({ op: 'multiShot', value: 1 }, 1),
        ...twoHundredCats(),
        { type: 'wave', z: 120, enemy: 'puppy', pattern: 'line', count: 5 },
      ]),
      seed: 1,
    })
    stepUntil(run, (state) => state.squad.z > 16, 6000)
    expect(run.state.squad.count).toBe(200)

    const hpSeen = new Set<number>()
    while (run.state.squad.z < 120 && run.state.status === 'running') {
      run.step(noSteering)
      for (const enemy of run.state.enemies) hpSeen.add(enemy.hp)
    }

    expect(hpSeen.has(3)).toBe(true)
    expect([...hpSeen].filter((hp) => hp !== 3 && hp !== 1)).toEqual([])
  })

  it('squad_of_200_with_one_range_gate_counts_the_longer_flight_toward_the_cap', () => {
    // 200 × 2 × 40 ÷ 30 = 533 would be in flight, so N is 2 and about 267 are in flight
    const run = createRun({ level: levelOf([...repeatedRows({ op: 'range', value: 10 }, 1), ...twoHundredCats()]), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 16, 6000)
    expect(run.state.squad.count).toBe(200)
    stepTicks(run, 120)

    const inFlight = yarnBallsInFlightPerTick(run, 120)

    expect(average(inFlight)).toBeGreaterThanOrEqual(267 * 0.9)
    expect(average(inFlight)).toBeLessThanOrEqual(267 * 1.1)
  })

  it('squad_of_200_with_one_fire_rate_gate_counts_the_faster_fire_toward_the_cap', () => {
    // 200 × 2.4 × 1 = 480 would be in flight, so N is 2 and about 240 are in flight
    const run = createRun({ level: levelOf([...repeatedRows({ op: 'fireRate', value: 20 }, 1), ...twoHundredCats()]), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 16, 6000)
    expect(run.state.squad.count).toBe(200)
    stepTicks(run, 120)

    const inFlight = yarnBallsInFlightPerTick(run, 120)

    expect(average(inFlight)).toBeGreaterThanOrEqual(240 * 0.9)
    expect(average(inFlight)).toBeLessThanOrEqual(240 * 1.1)
  })

  it('squad_of_999_with_every_buff_at_its_cap_never_has_more_than_400_yarn_balls_in_flight', () => {
    const run = createRun({
      level: levelOf(
        [
          ...repeatedRows({ op: 'fireRate', value: 20 }, 10, 5),
          ...repeatedRows({ op: 'multiShot', value: 1 }, 4, 55),
          ...repeatedRows({ op: 'range', value: 10 }, 3, 75),
          ...repeatedRows({ op: 'multiply', value: 2 }, 10, 90),
        ],
        400,
      ),
      seed: 1,
    })

    const inFlight = yarnBallsInFlightPerTick(run, 2400)

    expect(run.state.squad.count).toBe(999)
    expect(run.state.weapon.fireRate).toBeCloseTo(6, 9)
    expect(run.state.weapon.yarnBallsPerShot).toBe(5)
    expect(run.state.weapon.range).toBe(60)
    expect(Math.max(...inFlight)).toBeLessThanOrEqual(400)
  })

  it('yarn_ball_standing_for_2_cats_after_a_damage_gate_deals_2_times_its_damage', () => {
    // 256 cats would have 512 in flight, so N is 2: each yarn ball deals 2 × 2 = 4 to a 40 HP bulldog
    const run = createRun({
      level: levelOf([
        ...doublingRows(8),
        { type: 'gates', z: 85, left: { op: 'damage', value: 1 }, right: { op: 'damage', value: 1 } },
        { type: 'wave', z: 150, enemy: 'bulldog', pattern: 'line', count: 5 },
      ]),
      seed: 1,
    })
    stepUntil(run, (state) => state.squad.z > 86, 6000)
    expect(run.state.squad.count).toBe(256)

    const hpSeen = new Set<number>()
    while (run.state.squad.z < 150 && run.state.status === 'running') {
      run.step(noSteering)
      for (const enemy of run.state.enemies) hpSeen.add(enemy.hp)
    }

    expect([...hpSeen].some((hp) => hp < 40)).toBe(true)
    expect([...hpSeen].filter((hp) => (40 - hp) % 4 !== 0)).toEqual([])
  })
})
