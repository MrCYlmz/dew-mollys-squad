import { describe, expect, it } from 'vitest'
import type { Gate, Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { doublingRows, everyLane, levelOf, noSteering, repeatedRows, steerTo, stepTicks, stepUntil } from './runHarness'

type BuffBlockEvent = Extract<Level['events'][number], { type: 'buffBlock' }>
type Lane = BuffBlockEvent['lane']
type BigBuff = BuffBlockEvent['buff']

const unbreakable = 1_000_000

function buffBlock(z: number, lane: Lane, hp: number, buff: BigBuff): BuffBlockEvent {
  return { type: 'buffBlock', z, lane, hp, buff }
}

// One row that gives a squad of exactly count cats, wherever it steers.
function squadOf(count: number): Level['events'] {
  return count > 1 ? [{ type: 'gates', z: 5, ...everyLane({ op: 'add', value: count - 1 }) }] : []
}

function startRun(events: Level['events'], x = 0, level = 1): Run {
  const run = createRun({ level: levelOf(events, 300, level), seed: 1 })
  if (x !== 0) steerTo(run, x)
  return run
}

function eventsOf<T extends GameEvent['type']>(events: GameEvent[], type: T) {
  return events.filter((event) => event.type === type)
}

describe('buff block', () => {
  it('buff_block_stands_where_the_level_puts_it_from_the_start', () => {
    // The example from docs/domain/levels.md.
    const run = startRun([buffBlock(120, 'right', 40, 'multiply')])

    expect(run.state.buffBlocks).toEqual([expect.objectContaining({ lane: 'right', z: 120, hp: 40, buff: 'multiply' })])
    expect(run.state.bigBuffs).toEqual([])
  })

  it('buff_block_hp_scales_with_the_level_number_like_enemy_hp', () => {
    // docs/domain/levels.md: a block with "hp": 40 has 40 × 1.08⁴ = 54.419… HP on level 5.
    const run = startRun([buffBlock(120, 'right', 40, 'multiply')], 0, 5)

    expect(run.state.buffBlocks[0].hp).toBeCloseTo(54.419, 2)
  })

  it('each_yarn_ball_takes_its_damage_from_a_buff_block', () => {
    const run = startRun([buffBlock(60, 'centre', 100, 'add')])
    const hpSeen = [100]

    while (run.state.squad.z < 55 && run.state.status === 'running') {
      run.step(noSteering)
      const hp = run.state.buffBlocks[0].hp
      if (hp !== hpSeen[hpSeen.length - 1]) hpSeen.push(hp)
    }

    expect(hpSeen.length).toBeGreaterThan(1)
    hpSeen.forEach((hp, index) => expect(hp).toBe(100 - index))
  })

  it('yarn_ball_standing_for_3_cats_deals_3_damage_to_a_buff_block', () => {
    // 512 cats would have 1,024 yarn balls in flight, so each yarn ball stands for 3 cats.
    const run = startRun([...doublingRows(9), buffBlock(150, 'centre', unbreakable, 'add')])
    stepUntil(run, (state) => state.squad.z > 100, 6000)
    expect(run.state.squad.count).toBe(512)
    let hp = run.state.buffBlocks[0].hp
    let drops = 0

    while (run.state.squad.z < 140 && run.state.status === 'running') {
      run.step(noSteering)
      const drop = hp - run.state.buffBlocks[0].hp
      hp = run.state.buffBlocks[0].hp
      if (drop === 0) continue
      drops++
      expect(drop % 3).toBe(0)
    }

    expect(drops).toBeGreaterThan(0)
  })

  it('yarn_balls_fly_on_up_to_the_front_edge_of_a_buff_block', () => {
    // A yarn ball moves 0.5 units a tick, so one heading into the block is seen within 0.5 units of its front edge first.
    const run = startRun([buffBlock(60, 'centre', unbreakable, 'add')])
    let nearestToTheBlock = -Infinity

    while (run.state.squad.z < 55 && run.state.status === 'running') {
      run.step(noSteering)
      for (const yarnBall of run.state.yarnBalls) nearestToTheBlock = Math.max(nearestToTheBlock, yarnBall.z)
    }

    expect(nearestToTheBlock).toBeGreaterThan(60 - 0.5)
    expect(nearestToTheBlock).toBeLessThanOrEqual(60)
  })

  it('yarn_ball_stops_at_a_buff_block_in_front_of_a_puppy', () => {
    // RANGE +10 lets the squad reach the block at z = 50 from z = 10. The puppy appears at z = 60 when the squad is at
    // z = 20 and walks through the block towards the squad; while it is still behind the block, no yarn ball reaches it.
    const run = startRun([
      ...repeatedRows({ op: 'range', value: 10 }, 1, 2),
      buffBlock(50, 'centre', unbreakable, 'add'),
      { type: 'wave', z: 60, enemy: 'puppy', pattern: 'line', count: 1 },
    ])
    const behindTheBlock = 50 + tuning.buffBlock.depth + tuning.hitRadius.puppy + tuning.hitRadius.yarnBall
    let ticksBehindTheBlock = 0

    stepUntil(run, (state) => state.enemies.length > 0, 600)
    while (run.state.status === 'running' && (run.state.enemies[0]?.z ?? 0) > behindTheBlock) {
      ticksBehindTheBlock++
      expect(run.state.enemies[0].hp).toBe(3)
      run.step(noSteering)
    }

    expect(ticksBehindTheBlock).toBeGreaterThan(60)
    expect(run.state.buffBlocks[0].hp).toBeLessThan(unbreakable)
  })

  it.each(['left', 'right'] as const)('yarn_balls_beside_a_%s_lane_buff_block_pass_it_and_the_squad_beside_it_loses_no_cats', (lane) => {
    const run = startRun([buffBlock(40, lane, 100, 'add')])

    const events = stepUntil(run, (state) => state.squad.z > 39, 6000)
    expect(run.state.buffBlocks).toEqual([expect.objectContaining({ lane, hp: 100 })])

    events.push(...stepUntil(run, (state) => state.squad.z > 45, 6000))
    expect(eventsOf(events, 'catsLost')).toEqual([])
    expect(run.state.squad.count).toBe(1)
    expect(eventsOf(events, 'buffBlockBroken')).toEqual([])
  })

  it('enemy_walks_on_through_a_buff_block', () => {
    // The block stops the squad's yarn balls, so the puppy walks through it unhurt; the squad stays before the block.
    const run = startRun([buffBlock(56, 'centre', unbreakable, 'add'), { type: 'wave', z: 60, enemy: 'puppy', pattern: 'line', count: 1 }])
    let nearestPuppyZ = Infinity

    while (run.state.squad.z < 45 && run.state.status === 'running') {
      run.step(noSteering)
      for (const puppy of run.state.enemies) nearestPuppyZ = Math.min(nearestPuppyZ, puppy.z)
    }

    expect(nearestPuppyZ).toBeLessThan(56 - 1)
    expect(run.state.buffBlocks).toEqual([expect.objectContaining({ lane: 'centre', z: 56 })])
  })

  it('barrel_splash_does_not_damage_a_buff_block', () => {
    // 2 cats in the centre lane break the barrel; the block in the left lane is within 3 units of it but out of their line of fire.
    const run = startRun([...squadOf(2), { type: 'barrel', z: 60, x: -1 }, buffBlock(61, 'left', 100, 'add')], -1)

    const events = stepUntil(run, (state) => state.barrels.length === 0, 6000)

    expect(eventsOf(events, 'barrelDestroyed')).toHaveLength(1)
    expect(run.state.buffBlocks[0].hp).toBe(100)
  })
})

describe('big buff', () => {
  it('broken_block_uncovers_its_big_buff_at_its_front_edge_and_the_squad_in_its_lane_collects_it', () => {
    // The example from docs/domain/run.md: a block in the left lane breaks, and a squad at x = −3 collects its buff.
    const run = startRun([buffBlock(60, 'left', 3, 'add')], -3)

    const events = stepUntil(run, (state) => state.squad.z >= 59.8, 6000)

    expect(eventsOf(events, 'buffBlockBroken')).toEqual([expect.objectContaining({ lane: 'left', buff: 'add' })])
    expect(run.state.buffBlocks).toEqual([])
    expect(run.state.bigBuffs).toEqual([expect.objectContaining({ lane: 'left', z: 60, buff: 'add' })])
    expect(run.state.squad.count).toBe(1)

    events.push(...stepUntil(run, (state) => state.squad.z > 60.5, 6000))

    expect(run.state.squad.count).toBe(31)
    expect(run.state.bigBuffs).toEqual([])
    expect(eventsOf(events, 'bigBuffCollected')).toEqual([expect.objectContaining({ buff: 'add', squadCount: 31 })])
    expect(eventsOf(events, 'catsLost')).toEqual([])
  })

  it('squad_out_of_the_lane_when_the_big_buff_reaches_it_loses_the_buff', () => {
    // The example from docs/domain/run.md: a squad still at x = 0 when the left lane's buff reaches it loses it.
    const run = startRun([buffBlock(60, 'left', 3, 'add')], -3)
    const events = stepUntil(run, (state) => state.bigBuffs.length > 0, 6000)
    expect(run.state.squad.z).toBeLessThan(55)
    steerTo(run, 0)

    events.push(...stepUntil(run, (state) => state.squad.z > 62, 6000))

    expect(run.state.squad.count).toBe(1)
    expect(eventsOf(events, 'bigBuffCollected')).toEqual([])
    expect(run.state.bigBuffs).toEqual([])
  })

  it('squad_in_the_right_lane_breaks_a_right_lane_block_and_collects_its_buff', () => {
    const run = startRun([buffBlock(60, 'right', 3, 'add')], 3)

    const events = stepUntil(run, (state) => state.squad.z > 60.5, 6000)

    expect(eventsOf(events, 'buffBlockBroken')).toEqual([expect.objectContaining({ lane: 'right', buff: 'add' })])
    expect(run.state.squad.count).toBe(31)
  })

  it('big_buff_that_reached_the_squad_beside_its_lane_is_lost_though_the_squad_steers_into_its_lane_before_it_is_behind', () => {
    // 25 cats stand up to about 1.5 units behind the squad's centre, so the buff is behind the last cat about 11 ticks
    // after it reached the centre; by then the squad has steered back into the left lane.
    const run = startRun([...squadOf(25), buffBlock(60, 'left', 1, 'add')], -3)
    const events = stepUntil(run, (state) => state.bigBuffs.length > 0, 6000)
    expect(run.state.squad.z).toBeLessThan(55)
    steerTo(run, 0)
    events.push(...stepUntil(run, (state) => state.squad.z >= 60, 6000))
    steerTo(run, -3)

    events.push(...stepUntil(run, (state) => state.squad.z > 64, 6000))

    expect(eventsOf(events, 'bigBuffCollected')).toEqual([])
    expect(run.state.squad.count).toBe(25)
  })

  it.each([
    ['add', 1, { count: 31, weapon: { fireRate: 2, damage: 1, yarnBallsPerShot: 1, range: 30 } }],
    ['multiply', 10, { count: 30, weapon: { fireRate: 2, damage: 1, yarnBallsPerShot: 1, range: 30 } }],
    ['fireRate', 1, { count: 1, weapon: { fireRate: 3.2, damage: 1, yarnBallsPerShot: 1, range: 30 } }],
    ['damage', 1, { count: 1, weapon: { fireRate: 2, damage: 4, yarnBallsPerShot: 1, range: 30 } }],
    ['multiShot', 1, { count: 1, weapon: { fireRate: 2, damage: 1, yarnBallsPerShot: 3, range: 30 } }],
    ['range', 1, { count: 1, weapon: { fireRate: 2, damage: 1, yarnBallsPerShot: 1, range: 60 } }],
  ] as const)('%s_big_buff_collected_by_a_squad_of_%i_at_the_base_values', (buff, squadCount, expected) => {
    // +30 cats, ×3 cats, FIRE RATE +60% of the base 2, DMG +3, +2 BULLET, RANGE +30
    const run = startRun([...squadOf(squadCount), buffBlock(40, 'centre', 1, buff)])

    stepUntil(run, (state) => state.squad.z > 41, 6000)

    expect(run.state.squad.count).toBe(expected.count)
    expect(run.state.weapon.fireRate).toBeCloseTo(expected.weapon.fireRate, 9)
    expect({ ...run.state.weapon, fireRate: expected.weapon.fireRate }).toEqual(expected.weapon)
  })

  it('squad_of_400_collecting_x3_becomes_999', () => {
    const run = startRun([
      { type: 'gates', z: 5, ...everyLane({ op: 'add', value: 99 }) },
      ...repeatedRows({ op: 'multiply', value: 2 }, 2, 10),
      buffBlock(40, 'centre', 1, 'multiply'),
    ])
    stepUntil(run, (state) => state.squad.z > 20, 6000)
    expect(run.state.squad.count).toBe(400)

    stepUntil(run, (state) => state.squad.z > 41, 6000)

    expect(run.state.squad.count).toBe(999)
  })

  it('add_big_buff_on_a_squad_of_999_leaves_999', () => {
    const run = startRun([...doublingRows(10), buffBlock(130, 'centre', 1, 'add')])

    stepUntil(run, (state) => state.squad.z > 131, 6000)

    expect(run.state.squad.count).toBe(999)
  })

  it('multi_shot_big_buff_on_4_yarn_balls_per_shot_gives_the_cap_of_5', () => {
    const run = startRun([...repeatedRows({ op: 'multiShot', value: 1 }, 3), buffBlock(40, 'centre', 1, 'multiShot')])
    stepUntil(run, (state) => state.squad.z > 20, 6000)
    expect(run.state.weapon.yarnBallsPerShot).toBe(4)

    stepUntil(run, (state) => state.squad.z > 41, 6000)

    expect(run.state.weapon.yarnBallsPerShot).toBe(5)
  })

  it('fire_rate_big_buff_on_5_2_gives_the_cap_of_6', () => {
    const run = startRun([...repeatedRows({ op: 'fireRate', value: 20 }, 8), buffBlock(60, 'centre', 1, 'fireRate')])
    stepUntil(run, (state) => state.squad.z > 45, 6000)
    expect(run.state.weapon.fireRate).toBeCloseTo(5.2, 9)

    stepUntil(run, (state) => state.squad.z > 61, 6000)

    expect(run.state.weapon.fireRate).toBeCloseTo(6, 9)
  })

  it.each([
    ['damage', { op: 'damage', value: 1 }, 'damage', 5],
    ['range', { op: 'range', value: 10 }, 'range', 70],
  ] as const)('%s_big_buff_adds_up_with_a_gate_without_a_cap', (buff, gate: Gate, value, expected) => {
    const run = startRun([...repeatedRows(gate, 1), buffBlock(40, 'centre', 1, buff)])

    stepUntil(run, (state) => state.squad.z > 41, 6000)

    expect(run.state.weapon[value]).toBe(expected)
  })
})

describe('running into a buff block', () => {
  it.each([1, 25])('squad_of_%i_whose_centre_runs_into_an_unbroken_block_loses_the_run_at_once', (count) => {
    const run = startRun([...squadOf(count), buffBlock(60, 'centre', unbreakable, 'add')])

    const events = stepUntil(run, (state) => state.squad.z > 62, 6000)

    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('ranIntoBlock')
    expect(run.state.squad.count).toBe(count)
    expect(eventsOf(events, 'catsLost')).toEqual([])
  })

  it('run_is_lost_in_the_tick_the_squad_centre_reaches_the_block_front_edge', () => {
    const run = startRun([buffBlock(60, 'left', unbreakable, 'add')], -3)
    let zBefore = 0

    while (run.state.status === 'running' && run.state.squad.z < 62) {
      zBefore = run.state.squad.z
      run.step(noSteering)
    }

    expect(run.state.lossCause).toBe('ranIntoBlock')
    expect(zBefore).toBeLessThan(60)
    expect(run.state.squad.z).toBeGreaterThanOrEqual(60)
  })

  it('squad_centre_steered_into_an_unbroken_block_while_it_passes_loses_the_run', () => {
    const run = startRun([buffBlock(60, 'left', unbreakable, 'add')])
    stepUntil(run, (state) => state.squad.z >= 60.2, 6000)
    expect(run.state.status).toBe('running')

    steerTo(run, -3)
    stepUntil(run, (state) => state.squad.z > 60 + tuning.buffBlock.depth, 6000)

    expect(run.state.lossCause).toBe('ranIntoBlock')
  })

  it('squad_centre_steered_into_the_block_lane_once_past_its_back_edge_is_safe', () => {
    // 25 cats reach about 1.5 units behind the centre, so the block still stands while the centre steers into its lane.
    const run = startRun([...squadOf(25), buffBlock(60, 'left', unbreakable, 'add')])
    stepUntil(run, (state) => state.squad.z > 60 + tuning.buffBlock.depth + 0.2, 6000)

    steerTo(run, -3)
    stepUntil(run, (state) => state.squad.z > 66, 6000)

    expect(run.state.status).toBe('running')
    expect(run.state.squad.x).toBeLessThan(-5 / 3)
  })

  it('squad_centre_exactly_at_the_block_front_edge_is_in_the_block', () => {
    // A block's front edge reaches the squad's centre when the distance travelled is its z: the block stands where an
    // empty run's squad is after 300 ticks.
    const emptyRun = startRun([])
    stepTicks(emptyRun, 300)
    const frontEdge = emptyRun.state.squad.z
    const run = startRun([buffBlock(frontEdge, 'centre', unbreakable, 'add')])

    stepUntil(run, (state) => state.squad.z >= frontEdge, 6000)

    expect(run.state.squad.z).toBe(frontEdge)
    expect(run.state.lossCause).toBe('ranIntoBlock')
  })

  it('squad_centre_steered_into_the_block_lane_exactly_at_its_back_edge_is_in_the_block', () => {
    // An empty run's squad is at the back edge after 300 ticks. The squad waits in the centre lane and steers into the left
    // lane on tick 300, so its centre first lies in the block's lane when the distance travelled is the block's z + its depth.
    const emptyRun = startRun([])
    stepTicks(emptyRun, 300)
    const backEdge = emptyRun.state.squad.z
    const frontEdge = backEdge - tuning.buffBlock.depth
    expect(frontEdge + tuning.buffBlock.depth).toBe(backEdge)
    const run = startRun([buffBlock(frontEdge, 'left', unbreakable, 'add')], -1)
    stepTicks(run, 298)
    expect(run.state.status).toBe('running')

    steerTo(run, -3)

    expect(run.state.squad.z).toBe(backEdge)
    expect(run.state.squad.x).toBeLessThan(-5 / 3)
    expect(run.state.lossCause).toBe('ranIntoBlock')
  })

  it('cats_reaching_into_the_block_lane_are_not_lost_while_the_squad_centre_is_beside_it', () => {
    // 25 cats around x = −1.4, in the centre lane, stand up to about 1.5 units to each side, so some reach into the left lane.
    const run = startRun([...squadOf(25), buffBlock(60, 'left', unbreakable, 'add')], -1.4)

    const events = stepUntil(run, (state) => state.squad.z > 66, 6000)

    expect(Math.min(...run.state.cats.map((cat) => cat.x))).toBeLessThan(-5 / 3)
    expect(eventsOf(events, 'catsLost')).toEqual([])
    expect(run.state.squad.count).toBe(25)
    expect(run.state.status).toBe('running')
  })

  it('block_the_squad_centre_misses_stays_until_past_the_last_cat', () => {
    const run = startRun([...squadOf(25), buffBlock(60, 'left', unbreakable, 'add')], -1.4)

    stepUntil(run, (state) => state.squad.z > 60.5, 6000)
    expect(run.state.buffBlocks).toHaveLength(1)

    stepUntil(run, (state) => state.squad.z > 66, 6000)
    expect(run.state.buffBlocks).toEqual([])
  })

  it('broken_block_is_no_obstacle', () => {
    const run = startRun([buffBlock(60, 'centre', 3, 'add')])

    const events = stepUntil(run, (state) => state.squad.z > 62, 6000)

    expect(eventsOf(events, 'buffBlockBroken')).toHaveLength(1)
    expect(run.state.status).toBe('running')
  })

  it('block_in_the_gate_tick_loses_the_run_before_the_gate_applies', () => {
    // Collisions come before gates, so the −30 gate the squad reaches in the same tick never takes its cats.
    const run = startRun([
      { type: 'gates', z: 60, ...everyLane({ op: 'subtract', value: 30 }) },
      buffBlock(60, 'centre', unbreakable, 'add'),
    ])

    stepUntil(run, (state) => state.squad.z > 62, 6000)

    expect(run.state.lossCause).toBe('ranIntoBlock')
    expect(run.state.squad.count).toBe(1)
  })
})

// 200 cats fire about 400 yarn balls a second, so the block takes damage in nearly every tick near it.
describe('buff block tick order', () => {
  const blockZ = 40

  // Per tick of a run of 200 cats at x towards an unbreakable block, until the run is lost or the block is past the last
  // cat: the damage dealt to the block by the end of the tick, the squad's z before and after it, and the run's status.
  function damageLog(lane: Lane, x: number) {
    const run = startRun([...squadOf(200), buffBlock(blockZ, lane, unbreakable, 'add')], x)
    const ticks: { damage: number; zBefore: number; zAfter: number; status: string }[] = []
    while (run.state.status === 'running') {
      const zBefore = run.state.squad.z
      run.step(noSteering)
      const block = run.state.buffBlocks[0]
      if (block === undefined) break
      ticks.push({ damage: unbreakable - block.hp, zBefore, zAfter: run.state.squad.z, status: run.state.status })
    }
    return ticks
  }

  function playWithHp(hp: number, lane: Lane, x: number) {
    const run = startRun([...squadOf(200), buffBlock(blockZ, lane, hp, 'add')], x)
    const events = stepUntil(run, (state) => state.squad.z >= blockZ + 5, 6000)
    return { run, events }
  }

  it('yarn_ball_that_breaks_a_block_in_the_tick_the_squad_centre_reaches_it_saves_the_run', () => {
    const ticks = damageLog('centre', 0)
    const contactTick = ticks.length - 1
    expect(ticks[contactTick].status).toBe('lost')
    expect(ticks[contactTick].zBefore).toBeLessThan(blockZ)
    expect(ticks[contactTick].zAfter).toBeGreaterThanOrEqual(blockZ)
    const during = ticks[contactTick].damage
    expect(during).toBeGreaterThan(ticks[contactTick - 1].damage)

    // Broken in the contact tick: yarn ball hits come before contacts, so the run goes on, and the big buff it uncovers
    // at the squad's centre is collected in that tick.
    const brokenInTheContactTick = playWithHp(during, 'centre', 0)
    expect(eventsOf(brokenInTheContactTick.events, 'buffBlockBroken')).toHaveLength(1)
    expect(eventsOf(brokenInTheContactTick.events, 'bigBuffCollected')).toHaveLength(1)
    expect(brokenInTheContactTick.run.state.status).toBe('running')

    // Still standing after the contact tick: the run is lost.
    const standingAtTheContact = playWithHp(during + 1, 'centre', 0)
    expect(standingAtTheContact.run.state.status).toBe('lost')
    expect(standingAtTheContact.run.state.lossCause).toBe('ranIntoBlock')
  })

  it('big_buff_uncovered_after_it_reached_the_squad_centre_is_lost', () => {
    // The squad's centre passes beside a left lane block, while its cats in the left lane go on hitting it.
    const ticks = damageLog('left', -1.4)
    const reachedTick = ticks.findIndex((tick) => tick.zAfter >= blockZ)
    expect(ticks[reachedTick].zBefore).toBeLessThan(blockZ)
    const damageWhenReached = ticks[reachedTick].damage
    expect(ticks.at(-1)?.damage).toBeGreaterThan(damageWhenReached)
    expect(ticks.at(-1)?.status).toBe('running')

    const uncoveredLate = playWithHp(damageWhenReached + 1, 'left', -1.4)
    expect(eventsOf(uncoveredLate.events, 'buffBlockBroken')).toHaveLength(1)
    expect(eventsOf(uncoveredLate.events, 'bigBuffCollected')).toEqual([])
    expect(uncoveredLate.run.state.squad.count).toBe(200)
  })
})
