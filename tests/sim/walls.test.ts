import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun } from '../../src/sim/run'
import { levelOf, noSteering, repeatedRows, steerTo, stepUntil } from './runHarness'

// A squad of exactly count cats: 1 cat lands fewer than 10 hits on the gate at z = 10, so it keeps its value.
function squadOf(count: number): Level['events'] {
  return [{ type: 'gates', z: 10, left: { op: 'add', value: count - 1 }, right: { op: 'add', value: count - 1 } }]
}

function runThrough(events: Level['events'], x: number, untilZ: number, level = 1) {
  const run = createRun({ level: levelOf(events, 300, level), seed: 1 })
  steerTo(run, x)
  const gameEvents = stepUntil(run, (state) => state.squad.z > untilZ, 6000)
  return { run, catsLost: gameEvents.filter((event) => event.type === 'catsLost') }
}

const leftHalfWall = { type: 'wall', z: 60, x: -2.5, width: 5 } as const

describe('wall', () => {
  it('wall_stands_where_the_level_puts_it_from_the_start', () => {
    const run = createRun({ level: levelOf([{ type: 'wall', z: 160, x: -2.5, width: 5 }]), seed: 1 })

    expect(run.state.walls).toEqual([expect.objectContaining({ x: -2.5, z: 160, width: 5 })])
  })

  it('squad_of_25_touching_a_wall_loses_10_cats_once_and_runs_on_through_it', () => {
    const { run, catsLost } = runThrough([...squadOf(25), leftHalfWall], -2.5, 70)

    expect(catsLost).toEqual([{ type: 'catsLost', count: 10 }])
    expect(run.state.squad.count).toBe(15)
    expect(run.state.status).toBe('running')
    expect(run.state.squad.z).toBeGreaterThan(70)
  })

  it('wall_cat_loss_does_not_scale_with_the_level_number', () => {
    const { run, catsLost } = runThrough([...squadOf(25), leftHalfWall], -2.5, 70, 5)

    expect(catsLost).toEqual([{ type: 'catsLost', count: 10 }])
    expect(run.state.squad.count).toBe(15)
  })

  it('squad_of_6_touching_a_wall_drops_to_0_and_loses_the_run', () => {
    const { run, catsLost } = runThrough([...squadOf(6), leftHalfWall], -2.5, 70)

    expect(catsLost).toEqual([{ type: 'catsLost', count: 6 }])
    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
  })

  it('each_wall_costs_cats_once', () => {
    const { run, catsLost } = runThrough([...squadOf(25), leftHalfWall, { ...leftHalfWall, z: 80 }], -2.5, 90)

    expect(catsLost).toEqual([
      { type: 'catsLost', count: 10 },
      { type: 'catsLost', count: 10 },
    ])
    expect(run.state.squad.count).toBe(5)
  })

  it('squad_beside_a_wall_loses_nothing', () => {
    const { run, catsLost } = runThrough([...squadOf(25), leftHalfWall], 2.5, 70)

    expect(catsLost).toEqual([])
    expect(run.state.squad.count).toBe(25)
  })

  // The wall covers x −5..0; a single cat at x touches it when its hit radius reaches past x = 0.
  it('cat_overlapping_the_wall_edge_touches_it', () => {
    const { run } = runThrough([leftHalfWall], tuning.hitRadius.cat - 0.02, 70)

    expect(run.state.status).toBe('lost')
  })

  it('cat_just_clear_of_the_wall_edge_does_not_touch_it', () => {
    const { run, catsLost } = runThrough([leftHalfWall], tuning.hitRadius.cat + 0.02, 70)

    expect(catsLost).toEqual([])
    expect(run.state.squad.count).toBe(1)
  })

  it('wall_disappears_once_past_the_last_cat', () => {
    const run = createRun({ level: levelOf([{ type: 'wall', z: 60, x: 4, width: 2 }]), seed: 1 })

    stepUntil(run, (state) => state.squad.z > 60, 6000)
    expect(run.state.walls).toHaveLength(1)

    stepUntil(run, (state) => state.squad.z > 64, 6000)
    expect(run.state.walls).toHaveLength(0)
  })

  it('wall_contact_in_the_gate_tick_applies_before_the_gate', () => {
    // A single cat touches the wall's front edge when the squad reaches z = 60.05, the same tick it takes
    // the +10 gate. Wall first: 1 − 10 leaves 0 and loses the run before the gate could add 10.
    const gateZ = 60.05
    const { run } = runThrough(
      [
        { type: 'gates', z: gateZ, left: { op: 'add', value: 10 }, right: { op: 'add', value: 10 } },
        { type: 'wall', z: gateZ + tuning.hitRadius.cat, x: 0, width: 10 },
      ],
      0,
      70,
    )

    expect(run.state.status).toBe('lost')
    expect(run.state.squad.count).toBe(0)
  })
})

describe('yarn balls and walls', () => {
  it('yarn_ball_stops_at_a_wall_in_front_of_a_puppy', () => {
    const run = createRun({
      level: levelOf([leftHalfWall, { type: 'wave', z: 70, enemy: 'puppy', pattern: 'column', count: 1, x: -2.5, spacing: 1 }]),
      seed: 1,
    })
    steerTo(run, -2.5)
    stepUntil(run, (state) => state.enemies.length > 0, 6000)
    let hitBehindTheWall = false
    let hitInFrontOfTheWall = false

    // Stops before the cat reaches the wall.
    while (run.state.squad.z < 59 && run.state.status === 'running') {
      run.step(noSteering)
      const puppy = run.state.enemies[0]
      if (puppy === undefined) break
      if (puppy.hp < 3 && puppy.z > 61.5) hitBehindTheWall = true
      if (puppy.hp < 3 && puppy.z < 59.5) hitInFrontOfTheWall = true
    }

    expect(hitBehindTheWall).toBe(false)
    expect(hitInFrontOfTheWall).toBe(true)
  })

  it('yarn_ball_stops_at_a_wall_in_front_of_a_gate_and_the_wall_stays', () => {
    // Without the wall, 8 cats would land about 8 × 2 × 3 = 48 hits on the gate from z = 25 to 48
    const run = createRun({
      level: levelOf([
        ...repeatedRows({ op: 'multiply', value: 2 }, 3),
        { type: 'wall', z: 50, x: -2.5, width: 5 },
        { type: 'gates', z: 55, left: { op: 'subtract', value: 15 }, right: { op: 'add', value: 5 } },
      ]),
      seed: 1,
    })
    steerTo(run, -2.5)

    stepUntil(run, (state) => state.squad.z > 48, 6000)

    expect(run.state.squad.count).toBe(8)
    expect(run.state.gateRows[3].left.value).toBe(-15)
    expect(run.state.walls).toEqual([expect.objectContaining({ x: -2.5, z: 50, width: 5 })])
  })
})
