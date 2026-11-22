import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type GameEvent } from '../../src/sim/run'
import { copied, everyLane, levelOf, noSteering, steerTo, stepUntil } from './runHarness'

// A squad of exactly count cats.
function squadOf(count: number): Level['events'] {
  return [{ type: 'gates', z: 10, ...everyLane({ op: 'add', value: count - 1 }) }]
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

  it('wall_stays_while_the_last_cat_is_inside_its_depth', () => {
    const run = createRun({ level: levelOf([{ type: 'wall', z: 60, x: 4, width: 2 }]), seed: 1 })

    stepUntil(run, (state) => state.squad.z > 60 + tuning.wall.depth - 0.2, 6000)

    expect(run.state.squad.z).toBeLessThan(60 + tuning.wall.depth)
    expect(run.state.walls).toHaveLength(1)
  })

  it('wall_contact_and_a_gate_in_the_same_tick_both_apply_in_that_tick', () => {
    // 31 cats, then a DMG +1 row every 0.1 units, so the squad takes at least one gate in every tick it touches the wall.
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 0.5, ...everyLane({ op: 'add', value: 30 }) },
        ...Array.from({ length: 150 }, (_, index) => ({
          type: 'gates' as const,
          z: 1 + index / 10,
          ...everyLane({ op: 'damage', value: 1 }),
        })),
        { type: 'wall', z: 10, x: 0, width: 10 },
      ]),
      seed: 1,
    })
    let wallTick: GameEvent[] | undefined

    while (wallTick === undefined && run.state.squad.z < 15 && run.state.status === 'running') {
      const events = copied(run.step(noSteering))
      if (events.some((event) => event.type === 'catsLost')) wallTick = events
    }

    expect(wallTick).toContainEqual({ type: 'catsLost', count: 10 })
    expect(wallTick?.some((event) => event.type === 'gateTaken')).toBe(true)
    expect(run.state.squad.count).toBe(21)
  })

  it('single_cat_first_touches_a_wall_at_its_front_edge', () => {
    // The cat's hit circle reaches z = 60 once the squad's centre is at 60 − 0.3; a tick moves it 8 / 60 units.
    const run = createRun({ level: levelOf([{ type: 'wall', z: 60, x: 0, width: 10 }]), seed: 1 })
    let zAtTheTouch: number | undefined

    while (zAtTheTouch === undefined && run.state.squad.z < 62 && run.state.status === 'running') {
      if (run.step(noSteering).some((event) => event.type === 'catsLost')) zAtTheTouch = run.state.squad.z
    }

    expect(zAtTheTouch).toBeGreaterThanOrEqual(60 - tuning.hitRadius.cat)
    expect(zAtTheTouch).toBeLessThan(60 - tuning.hitRadius.cat + 8 / 60)
  })

  it('wall_contact_in_the_gate_tick_applies_before_the_gate', () => {
    // A single cat touches the wall's front edge when the squad reaches z = 60.05, the same tick it takes
    // the +10 gate. Wall first: 1 − 10 leaves 0 and loses the run before the gate could add 10.
    const gateZ = 60.05
    const { run } = runThrough(
      [
        { type: 'gates', z: gateZ, ...everyLane({ op: 'add', value: 10 }) },
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

  // One cat on x = 0 fires straight ahead past a wall that ends 0.4 to the side, out of the cat's reach too.
  it.each([
    ['left', -0.9],
    ['right', 0.9],
  ])('yarn_ball_passing_beside_a_wall_on_the_%s_flies_on_to_a_barrel', (_, wallX) => {
    const run = createRun({
      level: levelOf([
        { type: 'wall', z: 10, x: wallX, width: 1 },
        { type: 'barrel', z: 14, x: 0 },
      ]),
      seed: 1,
    })

    stepUntil(run, (state) => state.squad.z > 9, 6000)

    expect(run.state.squad.count).toBe(1)
    expect(run.state.barrels[0].hp).toBeLessThan(10)
  })
})

// A yarn ball inside a wall has hit it and stopped there.
function yarnBallsInsideAWall(run: ReturnType<typeof createRun>): number {
  let inside = 0
  for (const wall of run.state.walls) {
    for (const yarnBall of run.state.yarnBalls) {
      const besideTheWall = Math.abs(yarnBall.x - wall.x) > wall.width / 2
      const beforeOrBehindTheWall = yarnBall.z < wall.z || yarnBall.z > wall.z + tuning.wall.depth
      if (!besideTheWall && !beforeOrBehindTheWall) inside++
    }
  }
  return inside
}

describe('yarn balls around a wall', () => {
  it('fanned_yarn_balls_stop_at_walls_and_fly_on_beside_them', () => {
    // One cat at x = −2 fires 5 yarn balls a shot, fanned up to ±10°, at walls across x = −1..1. Some reach a wall
    // through its front, some drift in through its side, others pass beside it, some drifting towards it. While the cat
    // is still before a wall, a yarn ball behind it has flown past its front.
    const wallZs = [30, 40.4, 50.8]
    const run = createRun({
      level: levelOf([
        ...[1, 2, 3, 4].map((z) => ({ type: 'gates' as const, z, ...everyLane({ op: 'multiShot', value: 1 }) })),
        ...[5, 6, 7].map((z) => ({ type: 'gates' as const, z, ...everyLane({ op: 'fireRate', value: 20 }) })),
        ...wallZs.map((z) => ({ type: 'wall' as const, z, x: 0, width: 2 })),
      ]),
      seed: 1,
    })
    steerTo(run, -2)
    let inside = 0
    let pastBesideDriftingTowards = 0

    const events = stepUntil(
      run,
      (state) => {
        inside += yarnBallsInsideAWall(run)
        pastBesideDriftingTowards += state.yarnBalls.filter(
          (yarnBall) => yarnBall.x < -1 && yarnBall.x > yarnBall.previousX && wallZs.some((z) => state.squad.z < z && yarnBall.z > z + tuning.wall.depth),
        ).length
        return state.squad.z > 53
      },
      6000,
    )

    expect(events.filter((event) => event.type === 'catsLost')).toEqual([])
    expect(run.state.weapon.yarnBallsPerShot).toBe(5)
    expect(pastBesideDriftingTowards).toBeGreaterThan(0)
    expect(inside).toBe(0)
  })

  it('yarn_balls_fired_from_beyond_a_wall_fly_on_while_it_stands', () => {
    // 25 cats run through the wall; while the last of them is still at it, the front cats already fire from beyond it.
    const run = createRun({ level: levelOf([...squadOf(25), leftHalfWall]), seed: 1 })
    steerTo(run, leftHalfWall.x)
    let inside = 0
    let beyondTheWall = 0

    stepUntil(run, (state) => {
      inside += yarnBallsInsideAWall(run)
      if (state.walls.length > 0) {
        beyondTheWall += state.yarnBalls.filter(
          (yarnBall) => yarnBall.z > leftHalfWall.z + tuning.wall.depth && Math.abs(yarnBall.x - leftHalfWall.x) < leftHalfWall.width / 2,
        ).length
      }
      return state.squad.z > 70
    }, 6000)

    expect(run.state.squad.count).toBe(15)
    expect(beyondTheWall).toBeGreaterThan(0)
    expect(inside).toBe(0)
  })
})

// One cat with 2 fire rate gates, so its yarn balls meet the wall at many offsets within a tick, straight or in a fan of 2.
// The wall spans the whole track at z = 20; every check ends before the cat reaches it.
describe('yarn balls reaching a wall and a barrel in the same tick', () => {
  const fireRateRows: Level['events'] = [1, 2].map((z) => ({ type: 'gates', z, ...everyLane({ op: 'fireRate', value: 20 }) }))
  const shots: [string, Level['events']][] = [
    ['straight', fireRateRows],
    ['in_a_fan', [{ type: 'gates', z: 0.5, ...everyLane({ op: 'multiShot', value: 1 }) }, ...fireRateRows]],
  ]

  // Three barrels side by side, close enough that every yarn ball of the fan meets one of them.
  function barrelHpBeforeTheWall(rows: Level['events'], barrelZ: number): number[] {
    const run = createRun({
      level: levelOf([
        ...rows,
        { type: 'wall', z: 20, x: 0, width: 10 },
        ...[-0.7, 0, 0.7].map((x) => ({ type: 'barrel' as const, z: barrelZ, x })),
      ]),
      seed: 1,
    })
    stepUntil(run, (state) => state.squad.z > 19, 6000)
    return run.state.barrels.map((barrel) => barrel.hp)
  }

  // Straight ahead, the barrels' hit circles start 0.03 behind the wall's front face.
  it.each(shots)('wall_shields_barrels_just_behind_its_front_face_from_yarn_balls_%s', (_, rows) => {
    expect(barrelHpBeforeTheWall(rows, 20 + tuning.hitRadius.yarnBall + tuning.hitRadius.barrel + 0.03)).toEqual([10, 10, 10])
  })

  // Straight ahead, the barrels' hit circles start 0.15 before the wall's front face.
  it.each(shots)('barrels_just_before_a_wall_take_yarn_balls_%s', (_, rows) => {
    const hp = barrelHpBeforeTheWall(rows, 20 + tuning.hitRadius.yarnBall + tuning.hitRadius.barrel - 0.15)
    expect(hp.reduce((total, barrelHp) => total + barrelHp, 0)).toBeLessThan(30)
  })
})
