import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type Run } from '../../src/sim/run'
import { everyLane, levelOf, noSteering, steerTo, stepTicks, stepUntil } from './runHarness'

// A squad of exactly count cats.
function squadOf(count: number): Level['events'] {
  return [{ type: 'gates', z: 10, ...everyLane({ op: 'add', value: count - 1 }) }]
}

function runThrough(events: Level['events'], x: number, untilZ: number) {
  const run = createRun({ level: levelOf(events), seed: 1 })
  if (x !== 0) steerTo(run, x)
  const gameEvents = stepUntil(run, (state) => state.squad.z > untilZ, 6000)
  return { run, catsLost: gameEvents.filter((event) => event.type === 'catsLost') }
}

// The squad's distance travelled before and after the tick in which the run was lost.
function lossTick(run: Run, untilZ: number) {
  while (run.state.status === 'running' && run.state.squad.z < untilZ) {
    const zBefore = run.state.squad.z
    run.step(noSteering)
    if (run.state.lossCause !== null) return { zBefore, zAfter: run.state.squad.z }
  }
  return undefined
}

const leftHalfWall = { type: 'wall', z: 60, x: -2.5, width: 5 } as const

describe('wall', () => {
  it('wall_stands_where_the_level_puts_it_from_the_start', () => {
    const run = createRun({ level: levelOf([{ type: 'wall', z: 160, x: -2.5, width: 5 }]), seed: 1 })

    expect(run.state.walls).toEqual([expect.objectContaining({ x: -2.5, z: 160, width: 5 })])
  })

  it.each([1, 25])('squad_of_%i_whose_centre_runs_into_a_wall_loses_the_run_at_once', (count) => {
    const { run, catsLost } = runThrough([...squadOf(count), leftHalfWall], -2.5, 70)

    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('ranIntoWall')
    expect(run.state.squad.count).toBe(count)
    expect(catsLost).toEqual([])
  })

  // The example from docs/domain/run.md: a wall over x −5..0 at z = 160.
  it.each([-1, 0])('squad_at_x_%s_is_lost_when_the_distance_travelled_reaches_the_wall', (x) => {
    const run = createRun({ level: levelOf([{ type: 'wall', z: 160, x: -2.5, width: 5 }]), seed: 1 })
    if (x !== 0) steerTo(run, x)

    const tick = lossTick(run, 170)

    expect(tick?.zBefore).toBeLessThan(160)
    expect(tick?.zAfter).toBeGreaterThanOrEqual(160)
    expect(run.state.lossCause).toBe('ranIntoWall')
  })

  it('squad_at_x_0_5_passes_a_wall_over_x_minus_5_to_0', () => {
    const { run, catsLost } = runThrough([{ type: 'wall', z: 160, x: -2.5, width: 5 }], 0.5, 170)

    expect(run.state.status).toBe('running')
    expect(run.state.squad.count).toBe(1)
    expect(catsLost).toEqual([])
  })

  it('wall_right_edge_is_part_of_the_wall', () => {
    const { run } = runThrough([{ type: 'wall', z: 60, x: 2.5, width: 5 }], 0, 70)

    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('ranIntoWall')
  })

  it('squad_centre_steered_into_a_wall_while_it_passes_loses_the_run', () => {
    const run = createRun({ level: levelOf([leftHalfWall]), seed: 1 })
    steerTo(run, 1)
    stepUntil(run, (state) => state.squad.z >= leftHalfWall.z + 0.2, 6000)
    expect(run.state.status).toBe('running')

    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.z > leftHalfWall.z + tuning.wall.depth, 6000)

    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('ranIntoWall')
  })

  it('squad_centre_steered_behind_a_wall_once_past_its_back_edge_is_safe', () => {
    const run = createRun({ level: levelOf([leftHalfWall]), seed: 1 })
    steerTo(run, 1)
    stepUntil(run, (state) => state.squad.z > leftHalfWall.z + tuning.wall.depth + 0.2, 6000)

    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.z > 70, 6000)

    expect(run.state.status).toBe('running')
  })

  it('squad_centre_exactly_at_the_wall_front_edge_is_in_the_wall', () => {
    // A wall's front edge reaches the squad's centre when the distance travelled is its z: the wall stands where an empty
    // run's squad is after 300 ticks.
    const emptyRun = createRun({ level: levelOf([]), seed: 1 })
    stepTicks(emptyRun, 300)
    const frontEdge = emptyRun.state.squad.z
    const run = createRun({ level: levelOf([{ type: 'wall', z: frontEdge, x: 0, width: 2 }]), seed: 1 })

    const tick = lossTick(run, frontEdge + 2)

    expect(tick?.zAfter).toBe(frontEdge)
    expect(run.state.lossCause).toBe('ranIntoWall')
  })

  it('cats_at_the_side_of_the_squad_that_clip_a_wall_are_not_lost', () => {
    // 25 cats around x = 1 stand up to about 1.5 units to each side, so some reach into the wall over x −5..0.
    const { run, catsLost } = runThrough([...squadOf(25), leftHalfWall], 1, 70)

    expect(catsLost).toEqual([])
    expect(run.state.squad.count).toBe(25)
    expect(run.state.status).toBe('running')
    expect(Math.min(...run.state.cats.map((cat) => cat.x))).toBeLessThan(0)
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

    stepUntil(run, (state) => state.squad.z > 60 + tuning.wall.depth - 0.25, 6000)

    expect(run.state.squad.z).toBeLessThan(60 + tuning.wall.depth)
    expect(run.state.walls).toHaveLength(1)
  })

  it('wall_in_the_gate_tick_loses_the_run_before_the_gate_applies', () => {
    // Collisions come before gates, so the −30 gate the squad reaches in the same tick never takes its cats.
    const { run } = runThrough(
      [
        { type: 'gates', z: 60, ...everyLane({ op: 'subtract', value: 30 }) },
        { type: 'wall', z: 60, x: 0, width: 10 },
      ],
      0,
      70,
    )

    expect(run.state.lossCause).toBe('ranIntoWall')
    expect(run.state.squad.count).toBe(1)
  })

  it('enemy_contact_in_the_wall_tick_comes_before_the_wall', () => {
    // Contacts in one tick are checked enemies first. A first run finds the tick a bulldog touches a squad of 1; the wall
    // is put where the squad's centre reaches it in that same tick. A wall moves no enemy, so the bulldog touches the
    // squad in that tick again and loses the run first, by its cats.
    const bulldog = { type: 'wave', z: 100, enemy: 'bulldog', pattern: 'column', count: 1, x: 0, spacing: 1 } as const
    const withoutWall = createRun({ level: levelOf([bulldog]), seed: 1 })
    const contact = lossTick(withoutWall, 120)
    expect(withoutWall.state.lossCause).toBe('outOfCats')
    if (contact === undefined) throw new Error('the bulldog did not touch the squad')

    const run = createRun({ level: levelOf([{ type: 'wall', z: contact.zAfter, x: 0, width: 10 }, bulldog]), seed: 1 })
    const events = stepUntil(run, () => false, 6000)

    expect(run.state.squad.z).toBe(contact.zAfter)
    expect(run.state.lossCause).toBe('outOfCats')
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: 1 }])
  })

  it('wall_and_buff_block_reached_in_the_same_tick_lose_the_run_to_the_wall', () => {
    const { run } = runThrough(
      [
        { type: 'wall', z: 60, x: 0, width: 1 },
        { type: 'buffBlock', z: 60, lane: 'centre', hp: 1_000_000, buff: 'add' },
      ],
      0,
      70,
    )

    expect(run.state.lossCause).toBe('ranIntoWall')
  })
})

describe('yarn balls and walls', () => {
  it('yarn_ball_stops_at_a_wall_in_front_of_a_puppy', () => {
    const run = createRun({
      level: levelOf([leftHalfWall, { type: 'wave', z: 64, enemy: 'puppy', pattern: 'column', count: 1, x: -2.5, spacing: 1 }]),
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
    // 25 cats around x = 0.3 pass the wall, those on the left clipping it; while some of them are still at it, others
    // on its side of the track already fire from beyond it.
    const run = createRun({ level: levelOf([...squadOf(25), leftHalfWall]), seed: 1 })
    steerTo(run, 0.3)
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

    expect(run.state.squad.count).toBe(25)
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
