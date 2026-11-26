import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type EnemyState, type GameEvent, type Run } from '../../src/sim/run'
import { copied, doublingRows, levelOf, noSteering, repeatedRows, steerTo, stepUntil } from './runHarness'

// requirements S-12 (6) and docs/domain/run.md "Dalmatian": a dalmatian defeated by a yarn ball or a barrel splash splits
// into 3 puppies at its x, at its z, z + 1 and z + 2, in the same tick; one that touches the squad or gets past it does not.

const puppyStep = 4 / 60
const chaseStep = tuning.enemyChaseSpeed / 60

// One cat with damage 13 from 12 damage gates kills a level 1 dalmatian of 12 HP with one yarn ball.
const oneShotKiller = repeatedRows({ op: 'damage', value: 1 }, 12, 3)

interface Split {
  killed: GameEvent & { type: 'enemyKilled' }
  enemies: EnemyState[]
  events: GameEvent[]
  run: Run
}

// Steps until a dalmatian is killed, and returns that tick's events and the enemies alive at its end.
function stepToDalmatianKill(run: Run, maxTicks = 6000): Split | null {
  for (let tick = 0; tick < maxTicks && run.state.status === 'running'; tick++) {
    const events = copied(run.step(noSteering))
    const killed = events.find((event): event is Split['killed'] => event.type === 'enemyKilled' && event.enemy === 'dalmatian')
    if (killed) return { killed, enemies: run.state.enemies.map((enemy) => ({ ...enemy })), events, run }
  }
  return null
}

function puppies(enemies: readonly EnemyState[]): EnemyState[] {
  return enemies.filter((enemy) => enemy.kind === 'puppy').sort((first, second) => first.z - second.z)
}

function runWith(events: Level['events'], level = 1, seed = 1): Run {
  return createRun({ level: levelOf(events, 300, level), seed })
}

describe('dalmatian split', () => {
  it('dalmatian_shot_down_leaves_3_puppies_in_the_same_tick', () => {
    const split = stepToDalmatianKill(runWith([...oneShotKiller, { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 }]))

    expect(split?.killed).toMatchObject({ enemy: 'dalmatian', cause: 'shot' })
    expect(puppies(split?.enemies ?? [])).toHaveLength(3)
  })

  it('split_puppies_stand_one_behind_the_other_1_unit_apart_from_the_dalmatian_place', () => {
    const split = stepToDalmatianKill(runWith([...oneShotKiller, { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 }]))
    if (split === null) throw new Error('the dalmatian was not killed')
    const [first, second, third] = puppies(split.enemies)

    // They move from the tick they appear in, all alike, so each may already be one step from its place.
    expect(Math.abs(first.z - split.killed.z)).toBeLessThanOrEqual(puppyStep + 1e-9)
    expect(Math.abs(first.x - split.killed.x)).toBeLessThanOrEqual(chaseStep + 1e-9)
    expect(second.z - first.z).toBeCloseTo(1, 9)
    expect(third.z - first.z).toBeCloseTo(2, 9)
    expect(second.x).toBe(first.x)
    expect(third.x).toBe(first.x)
  })

  it('split_puppies_appear_away_from_the_squad', () => {
    const split = stepToDalmatianKill(runWith([...oneShotKiller, { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 }]))
    if (split === null) throw new Error('the dalmatian was not killed')

    for (const puppy of puppies(split.enemies)) expect(puppy.z).toBeGreaterThan(split.run.state.squad.z)
  })

  // The yarn ball that kills does not hit the puppies; its 13 − 12 = 1 spare damage is lost.
  it('yarn_ball_that_kills_the_dalmatian_does_not_hit_its_puppies', () => {
    const split = stepToDalmatianKill(runWith([...oneShotKiller, { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 }]))

    expect(puppies(split?.enemies ?? []).map((puppy) => puppy.hp)).toEqual([3, 3, 3])
    expect(split?.events.filter((event) => event.type === 'enemyKilled')).toHaveLength(1)
  })

  it('split_puppies_have_the_puppy_hp_of_the_level_number', () => {
    // On level 2 the dalmatian has 12.96 HP, which damage 13 still kills with one yarn ball, and a puppy has 3.24.
    const split = stepToDalmatianKill(runWith([...oneShotKiller, { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 }], 2))

    expect(split?.killed).toMatchObject({ enemy: 'dalmatian', cause: 'shot' })
    for (const puppy of puppies(split?.enemies ?? [])) expect(puppy.hp).toBeCloseTo(3.24, 9)
    expect(puppies(split?.enemies ?? [])).toHaveLength(3)
  })

  it('split_puppies_chase_the_squad_like_any_puppy', () => {
    const split = stepToDalmatianKill(runWith([...oneShotKiller, { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 }]))
    if (split === null) throw new Error('the dalmatian was not killed')
    const { run } = split
    steerTo(run, 3)
    const before = puppies(run.state.enemies).map((puppy) => ({ ...puppy }))

    stepUntil(run, () => false, 10)

    const after = puppies(run.state.enemies)
    expect(after).toHaveLength(3)
    after.forEach((puppy, index) => {
      expect(puppy.z).toBeCloseTo(before[index].z - 10 * puppyStep, 6)
      expect(puppy.x).toBeGreaterThan(before[index].x)
    })
  })

  it('dalmatian_destroyed_by_a_barrel_splash_splits_and_the_splash_does_not_hit_its_puppies', () => {
    // A squad of 8 at x = 3 shoots a barrel in its line while a dalmatian coming from the left edge chases the squad across
    // the barrel. Sweeping where the dalmatian starts makes some splashes catch it; the dalmatian absorbs the shots that
    // reach it first, so in other runs the yarn balls kill it.
    let splashKills = 0
    for (let dalmatianZ = 41; dalmatianZ <= 56; dalmatianZ += 0.5) {
      const run = runWith([...doublingRows(3), { type: 'barrel', z: 50, x: 3 }, { type: 'wave', z: dalmatianZ, enemy: 'dalmatian', pattern: 'column', count: 1, x: -5, spacing: 1 }])
      steerTo(run, 3)
      const split = stepToDalmatianKill(run, 1200)
      if (split?.killed.cause !== 'barrel') continue
      splashKills++

      expect(puppies(split.enemies).map((puppy) => puppy.hp)).toEqual([3, 3, 3])
    }

    expect(splashKills).toBeGreaterThan(0)
  })

  it('dalmatian_that_touches_the_squad_dies_without_splitting', () => {
    // On level 25 a dalmatian has 12 × 1.08²⁴ ≈ 76 HP, more than 4 cats shoot before it arrives; the column of 1 grows to 3.
    const run = runWith([...doublingRows(2), { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'column', count: 1, x: 0, spacing: 3 }], 25)
    const events: GameEvent[] = []
    let mostPuppies = 0

    while (run.state.status === 'running' && !events.some((event) => event.type === 'catsLost')) {
      events.push(...copied(run.step(noSteering)))
      mostPuppies = Math.max(mostPuppies, puppies(run.state.enemies).length)
    }

    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([expect.objectContaining({ enemy: 'dalmatian', cause: 'contact' })])
    expect(mostPuppies).toBe(0)
    expect(run.state.squad.count).toBe(2)
  })

  it('dalmatian_that_gets_past_the_squad_disappears_without_splitting', () => {
    // 1 cat on level 9 waits at x = −4 for a dalmatian in its line and jumps to x = 4 when it is `gap` units ahead. There a
    // wave of 1 is still 1, and the dalmatian's 12 × 1.08⁸ ≈ 22 HP outlast the shots of 1 cat. Some gaps let it pass the
    // squad untouched; those runs must end with no enemy at all.
    let passedRuns = 0
    for (let gap = 1; gap <= 4; gap += 0.25) {
      const run = runWith([{ type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'column', count: 1, x: -4, spacing: 1 }], 9)
      steerTo(run, -4)
      stepUntil(run, (state) => state.enemies.length > 0 && state.enemies[0].z - state.squad.z < gap, 6000)
      steerTo(run, 4)
      const events = stepUntil(run, (state) => state.enemies.length === 0, 240)
      if (events.some((event) => event.type === 'catsLost' || event.type === 'enemyKilled')) continue
      passedRuns++

      expect(run.state.enemies).toEqual([])
      expect(run.state.squad.count).toBe(1)
    }

    expect(passedRuns).toBeGreaterThan(0)
  })
})

describe('with another split in the tuning config', () => {
  let documentedSplit = { puppies: 0, spacing: 0 }

  beforeEach(() => {
    documentedSplit = { ...tuning.dalmatianSplit }
  })

  afterEach(() => {
    Object.assign(tuning.dalmatianSplit, documentedSplit)
  })

  it('split_of_4_puppies_2_units_apart_stands_at_z_z_plus_2_z_plus_4_and_z_plus_6', () => {
    tuning.dalmatianSplit.puppies = 4
    tuning.dalmatianSplit.spacing = 2

    const split = stepToDalmatianKill(runWith([...oneShotKiller, { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 }]))
    if (split === null) throw new Error('the dalmatian was not killed')
    const left = puppies(split.enemies)

    expect(left).toHaveLength(4)
    left.forEach((puppy, index) => expect(puppy.z - left[0].z).toBeCloseTo(2 * index, 9))
  })
})

describe('dalmatian split under the enemy cap', () => {
  // The example from docs/domain/run.md: with 150 enemies alive, a dalmatian defeated leaves 149, so its first puppy
  // appears and the other two are dropped. 149 bulldogs in single file stand behind the dalmatian, which takes the shot.
  it('dalmatian_defeated_with_150_alive_leaves_only_its_nearest_puppy', () => {
    const run = runWith([
      ...oneShotKiller,
      { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 },
      { type: 'wave', z: 101, enemy: 'bulldog', pattern: 'column', count: 149, x: 0, spacing: 0.5 },
    ])
    stepUntil(run, (state) => state.enemies.length === 150, 6000)

    const split = stepToDalmatianKill(run)
    if (split === null) throw new Error('the dalmatian was not killed')

    expect(split.enemies).toHaveLength(150)
    expect(split.enemies.filter((enemy) => enemy.kind === 'bulldog')).toHaveLength(149)
    const [puppy, ...dropped] = puppies(split.enemies)
    expect(dropped).toEqual([])
    expect(Math.abs(puppy.z - split.killed.z)).toBeLessThanOrEqual(puppyStep + 1e-9)
  })

  it('dalmatian_defeated_with_149_alive_leaves_its_two_nearest_puppies', () => {
    const run = runWith([
      ...oneShotKiller,
      { type: 'wave', z: 100, enemy: 'dalmatian', pattern: 'line', count: 1 },
      { type: 'wave', z: 101, enemy: 'bulldog', pattern: 'column', count: 148, x: 0, spacing: 0.5 },
    ])

    const split = stepToDalmatianKill(run)
    if (split === null) throw new Error('the dalmatian was not killed')

    const kept = puppies(split.enemies)
    expect(split.enemies).toHaveLength(150)
    expect(kept).toHaveLength(2)
    expect(Math.abs(kept[0].z - split.killed.z)).toBeLessThanOrEqual(puppyStep + 1e-9)
    expect(kept[1].z - kept[0].z).toBeCloseTo(1, 9)
  })
})
