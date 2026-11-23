import { describe, expect, it } from 'vitest'
import type { Gate, Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type Run } from '../../src/sim/run'
import { doublingRows, everyLane, levelOf, noSteering, repeatedRows, steerTo, stepTicks, stepUntil } from './runHarness'

type Lane = 'left' | 'right'

const fireRate: Gate = { op: 'fireRate', value: 20 }
const damage: Gate = { op: 'damage', value: 1 }
const multiShot: Gate = { op: 'multiShot', value: 1 }
const range: Gate = { op: 'range', value: 10 }
const double: Gate = { op: 'multiply', value: 2 }

const buffs: [string, Gate][] = [
  ['fire_rate', fireRate],
  ['damage', damage],
  ['multi_shot', multiShot],
  ['range', range],
]

function averageYarnBallsInFlight(run: Run, ticks: number): number {
  let total = 0
  for (let tick = 0; tick < ticks; tick++) {
    stepTicks(run, 1)
    total += run.state.yarnBalls.length
  }
  return total / ticks
}

// Takes every row of the level and returns the weapon values seen right after each gate taken.
function weaponAfterEachGate(rows: Level['events']) {
  const run = createRun({ level: levelOf(rows), seed: 1 })
  const seen: { fireRate: number; damage: number; yarnBallsPerShot: number; range: number }[] = []
  while (run.state.status === 'running' && run.state.gateRows.some((row) => row.taken === null)) {
    const events = run.step(noSteering)
    if (events.some((event) => event.type === 'gateTaken')) seen.push({ ...run.state.weapon })
  }
  return { run, seen }
}

// One cat that has taken the given rows, then empty track for 2 s so every yarn ball in flight was fired with the buffs.
function oneCatAfter(rows: Level['events']) {
  const lastRowZ = rows.at(-1)?.z ?? 0
  const run = createRun({ level: levelOf(rows), seed: 1 })
  stepUntil(run, (state) => state.squad.z > lastRowZ + 1, 6000)
  stepTicks(run, 120)
  return run
}

describe('weapon at the start of a run', () => {
  it('run_starts_with_the_base_values_of_level_1', () => {
    const run = createRun({ level: levelOf([]), seed: 1 })

    expect(run.state.weapon).toEqual({ fireRate: 2, damage: 1, yarnBallsPerShot: 1, range: 30 })
  })
})

describe('fire rate gate', () => {
  it('each_fire_rate_gate_adds_20_percent_of_the_base_rate_up_to_3_times_the_base', () => {
    // 2.4, 2.8, … up to 6 after ten gates; an eleventh changes nothing
    const { seen } = weaponAfterEachGate(repeatedRows(fireRate, 11))

    const expected = [2.4, 2.8, 3.2, 3.6, 4, 4.4, 4.8, 5.2, 5.6, 6, 6]
    expect(seen).toHaveLength(expected.length)
    seen.forEach((weapon, index) => expect(weapon.fireRate).toBeCloseTo(expected[index], 9))
  })

  it('fire_rate_gate_at_the_cap_is_still_taken', () => {
    const { run } = weaponAfterEachGate(repeatedRows(fireRate, 11))

    expect(run.state.gateRows[10].taken).not.toBeNull()
    expect(run.state.squad.count).toBe(1)
  })

  // A yarn ball flies 1 s, so the yarn balls in flight per cat equal its fire rate.
  it('one_cat_after_one_fire_rate_gate_fires_2_4_yarn_balls_per_second', () => {
    const run = oneCatAfter(repeatedRows(fireRate, 1))

    expect(Math.abs(averageYarnBallsInFlight(run, 300) - 2.4)).toBeLessThanOrEqual(0.15)
  })

  it('one_cat_at_the_fire_rate_cap_fires_6_yarn_balls_per_second', () => {
    const run = oneCatAfter(repeatedRows(fireRate, 11))

    expect(Math.abs(averageYarnBallsInFlight(run, 300) - 6)).toBeLessThanOrEqual(0.3)
  })

  it('cats_that_join_after_a_fire_rate_gate_fire_with_the_buff', () => {
    // 2 cats at 2.4 yarn balls/s
    const run = oneCatAfter([...repeatedRows(fireRate, 1), { type: 'gates', z: 10, ...everyLane(double) }])

    expect(run.state.squad.count).toBe(2)
    expect(Math.abs(averageYarnBallsInFlight(run, 300) - 4.8)).toBeLessThanOrEqual(0.3)
  })
})

describe('damage gate', () => {
  it('each_damage_gate_adds_1_damage_without_a_cap', () => {
    const { seen } = weaponAfterEachGate(repeatedRows(damage, 6))

    expect(seen.map((weapon) => weapon.damage)).toEqual([2, 3, 4, 5, 6, 7])
  })

  it('yarn_ball_after_a_damage_gate_takes_2_hp_from_a_puppy', () => {
    const run = createRun({
      level: levelOf([...repeatedRows(damage, 1), { type: 'wave', z: 60, enemy: 'puppy', pattern: 'line', count: 1 }]),
      seed: 1,
    })
    stepUntil(run, (state) => state.enemies.length > 0, 600)
    const hpSeen = [run.state.enemies[0].hp]
    let shotKills = 0

    while (run.state.enemies.length > 0 && run.state.status === 'running') {
      const events = run.step(noSteering)
      shotKills += events.filter((event) => event.type === 'enemyKilled' && event.cause === 'shot').length
      const hp = run.state.enemies[0]?.hp
      if (hp !== undefined && hp !== hpSeen[hpSeen.length - 1]) hpSeen.push(hp)
    }

    expect(hpSeen).toEqual([3, 1])
    expect(shotKills).toBe(1)
  })
})

describe('multi-shot gate', () => {
  it('each_multi_shot_gate_adds_1_yarn_ball_per_shot_up_to_5', () => {
    const { seen } = weaponAfterEachGate(repeatedRows(multiShot, 6))

    expect(seen.map((weapon) => weapon.yarnBallsPerShot)).toEqual([2, 3, 4, 5, 5, 5])
  })

  it('multi_shot_gate_at_the_cap_is_still_taken', () => {
    const { run } = weaponAfterEachGate(repeatedRows(multiShot, 6))

    expect(run.state.gateRows[5].taken).not.toBeNull()
  })

  it('one_cat_after_one_multi_shot_gate_fires_4_yarn_balls_per_second', () => {
    const run = oneCatAfter(repeatedRows(multiShot, 1))

    expect(Math.abs(averageYarnBallsInFlight(run, 300) - 4)).toBeLessThanOrEqual(0.25)
  })

  it('one_cat_at_the_multi_shot_cap_fires_10_yarn_balls_per_second', () => {
    const run = oneCatAfter(repeatedRows(multiShot, 6))

    expect(Math.abs(averageYarnBallsInFlight(run, 300) - 10)).toBeLessThanOrEqual(0.5)
  })

  // Each yarn ball's direction from its last step, in degrees from straight ahead.
  function fanAngles(gates: number): number[] {
    const run = oneCatAfter(repeatedRows(multiShot, gates))
    const angles = new Set<number>()
    for (let tick = 0; tick < 60; tick++) {
      run.step(noSteering)
      for (const yarnBall of run.state.yarnBalls) {
        const dx = yarnBall.x - yarnBall.previousX
        const dz = yarnBall.z - yarnBall.previousZ
        angles.add(Math.round((Math.atan2(dx, dz) * 180) / Math.PI * 100) / 100)
      }
    }
    return [...angles].sort((a, b) => a - b)
  }

  it.each([
    [1, [0]],
    [2, [-2.5, 2.5]],
    [3, [-5, 0, 5]],
    [5, [-10, -5, 0, 5, 10]],
  ])('%i_yarn_balls_per_shot_fan_out_5_degrees_apart_around_straight_ahead', (yarnBallsPerShot, expected) => {
    expect(fanAngles(yarnBallsPerShot - 1)).toEqual(expected)
  })

  it('yarn_ball_in_a_fan_flies_at_30_units_per_second_along_its_direction', () => {
    const run = oneCatAfter(repeatedRows(multiShot, 4))

    run.step(noSteering)

    expect(run.state.yarnBalls.length).toBeGreaterThan(0)
    for (const yarnBall of run.state.yarnBalls) {
      expect(Math.hypot(yarnBall.x - yarnBall.previousX, yarnBall.z - yarnBall.previousZ)).toBeCloseTo(30 / 60, 9)
    }
  })
})

describe('range gate', () => {
  it('each_range_gate_adds_10_units_without_a_cap', () => {
    const { seen } = weaponAfterEachGate(repeatedRows(range, 4))

    expect(seen.map((weapon) => weapon.range)).toEqual([40, 50, 60, 70])
  })

  it('yarn_ball_after_a_range_gate_flies_40_units', () => {
    // A yarn ball fired from the single cat at the squad's z has flown f units when it is
    // f − run speed × f / 30 ahead of the squad, so at 40 units of range it gets at most 40 − run speed × 4/3 ahead.
    const run = oneCatAfter(repeatedRows(range, 1))
    let farthestAhead = 0

    for (let tick = 0; tick < 120; tick++) {
      run.step(noSteering)
      for (const yarnBall of run.state.yarnBalls) farthestAhead = Math.max(farthestAhead, yarnBall.z - run.state.squad.z)
    }

    const expected = 40 - (tuning.squad.forwardSpeed * 40) / 30
    expect(farthestAhead).toBeLessThanOrEqual(expected + 1e-9)
    expect(farthestAhead).toBeGreaterThanOrEqual(expected - 0.5)
  })
})

describe('weapon-buff gates in a row', () => {
  // A squad of 8 cats left of centre facing the gate row under test at z = 60.
  function squadFacingGateRow(left: Gate, right: Gate) {
    const run = createRun({ level: levelOf([...doublingRows(3), { type: 'gates', z: 60, left, right }]), seed: 1 })
    steerTo(run, -2.5)
    return run
  }

  it.each(buffs)('%s_gate_is_blue_and_does_not_change_when_shot', (_name, buff) => {
    const run = squadFacingGateRow(buff, { op: 'add', value: 5 })
    const seen: { value: number; colour: string }[] = []

    while (run.state.gateRows[3].taken === null && run.state.status === 'running') {
      const gate = run.state.gateRows[3].left
      if (gate) seen.push({ value: gate.value, colour: gate.colour })
      run.step(noSteering)
    }

    expect(seen.length).toBeGreaterThan(0)
    for (const gate of seen) expect(gate).toEqual({ value: buff.value, colour: 'blue' })
    expect(run.state.gateRows[3].taken).toBe('left')
  })

  it('taking_one_gate_of_a_row_mixing_add_and_damage_leaves_the_other', () => {
    const row = (lane: Lane) => {
      const run = createRun({
        level: levelOf([{ type: 'gates', z: 30, left: { op: 'add', value: 10 }, right: damage }]),
        seed: 1,
      })
      steerTo(run, lane === 'left' ? -2.5 : 2.5)
      const events = stepUntil(run, (state) => state.squad.z > 31, 6000)
      return { state: run.state, gateTaken: events.filter((event) => event.type === 'gateTaken') }
    }

    const left = row('left')
    const right = row('right')

    expect(left.state.squad.count).toBe(11)
    expect(left.state.weapon.damage).toBe(1)
    expect(left.gateTaken).toEqual([{ type: 'gateTaken', lane: 'left', op: 'add', value: 10, squadCount: 11 }])
    expect(right.state.squad.count).toBe(1)
    expect(right.state.weapon.damage).toBe(2)
    expect(right.gateTaken).toEqual([{ type: 'gateTaken', lane: 'right', op: 'damage', value: 1, squadCount: 1 }])
  })
})
