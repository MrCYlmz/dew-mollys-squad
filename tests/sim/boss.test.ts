import { afterEach, describe, expect, it } from 'vitest'
import type { BossKind, Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type GameEvent, type Run, type RunState } from '../../src/sim/run'
import { bossLevelOf, copied, doublingRows, everyLane, noSteering, repeatedRows, steerTo, stepTicks, stepToArena, stepUntil } from './runHarness'

// Values from docs/domain/run.md (Boss) and levels.md (Balancing).
const length = 300
const bossStartZ = length + 35
const walkSpeed: Record<BossKind, number> = { dustbot: 1.5, megaDustbot: 1.7 }
const walkStep = (boss: BossKind) => walkSpeed[boss] / 60
const hitRadius: Record<BossKind, number> = { dustbot: 2, megaDustbot: 2.5 }
const catRadius = 0.3
const yarnBallRadius = 0.12
// An HP no squad in these tests can shoot down before the boss reaches it.
const unbeatable = 100000

function bossRun(boss: BossKind, expectedSquadAtBoss: number, events: Level['events'] = [], seed = 1, level = 1): Run {
  return createRun({ level: bossLevelOf(events, { boss, expectedSquadAtBoss, level }), seed })
}

function nearestCatDistance(state: RunState): number {
  const boss = state.boss
  if (boss === null) return Infinity
  return Math.min(...state.cats.map((cat) => Math.hypot(cat.x - boss.x, cat.z - boss.z)))
}

describe('boss arena', () => {
  it('boss_is_not_there_before_the_squad_reaches_the_arena', () => {
    const run = bossRun('dustbot', 60)

    const events = stepUntil(run, (state) => state.squad.z >= length - 0.2, 6000)

    expect(run.state.boss).toBeNull()
    expect(events.filter((event) => event.type === 'bossEntered')).toEqual([])
  })

  it('boss_enters_when_the_squad_centre_reaches_the_arena_start', () => {
    const run = bossRun('dustbot', 60)

    const events = stepToArena(run)

    expect(run.state.squad.previousZ).toBeLessThan(length)
    expect(run.state.squad.z).toBe(length)
    expect(events.filter((event) => event.type === 'bossEntered')).toEqual([{ type: 'bossEntered', boss: 'dustbot' }])
  })

  it.each<BossKind>(['dustbot', 'megaDustbot'])('%s_enters_at_x_0_35_units_beyond_the_arena_start', (boss) => {
    const run = bossRun(boss, 60)

    stepToArena(run)

    // It may already have taken its first step in the tick it enters.
    expect(run.state.boss).toEqual(expect.objectContaining({ kind: boss, x: 0 }))
    expect(run.state.boss?.z).toBeLessThanOrEqual(bossStartZ)
    expect(run.state.boss?.z).toBeGreaterThanOrEqual(bossStartZ - walkStep(boss) - 1e-9)
  })

  it('squad_reaching_the_arena_does_not_win_the_run', () => {
    const run = bossRun('dustbot', unbeatable)
    stepUntil(run, (state) => state.squad.z >= length, 6000)

    stepTicks(run, 120)

    expect(run.state.squad.z).toBe(length)
    expect(run.state.status).toBe('running')
  })

  it('squad_stops_at_the_arena_start', () => {
    const run = bossRun('dustbot', unbeatable)
    stepToArena(run)

    for (let tick = 0; tick < 120; tick++) {
      run.step(noSteering)
      expect(run.state.squad.z).toBe(length)
      expect(run.state.squad.previousZ).toBe(length)
    }
  })

  it('squad_still_steers_in_the_arena_within_the_track', () => {
    const run = bossRun('dustbot', unbeatable)
    stepToArena(run)

    steerTo(run, -3)
    stepTicks(run, 30)
    expect(run.state.squad.x).toBeCloseTo(-3, 2)

    run.step({ drag: 20, left: false, right: false })
    stepTicks(run, 30)
    expect(run.state.squad.steeringPoint).toBe(5)
    expect(run.state.squad.x).toBeCloseTo(5, 2)
    expect(run.state.squad.z).toBe(length)
  })

  it.each<[BossKind, number]>([
    ['dustbot', 1.5],
    ['megaDustbot', 1.7],
  ])('%s_walks_toward_a_still_squad_at_%d_units_per_second', (boss, speed) => {
    const run = bossRun(boss, unbeatable, doublingRows(3))
    stepToArena(run)
    const start = { ...run.state.boss! }

    stepTicks(run, 60)

    expect(start.z - run.state.boss!.z).toBeCloseTo(speed, 6)
    expect(run.state.boss!.x).toBe(0)
  })

  it('boss_follows_the_squad_centre_as_it_steers', () => {
    const run = bossRun('dustbot', unbeatable, doublingRows(3))
    stepToArena(run)
    steerTo(run, 4)
    stepTicks(run, 120)

    for (let tick = 0; tick < 60; tick++) {
      const before = { ...run.state.boss! }
      run.step(noSteering)
      const after = run.state.boss!
      const toSquadX = run.state.squad.x - before.x
      const toSquadZ = run.state.squad.z - before.z
      const toSquad = Math.hypot(toSquadX, toSquadZ)
      const stepX = after.x - before.x
      const stepZ = after.z - before.z

      expect(Math.hypot(stepX, stepZ)).toBeCloseTo(walkStep('dustbot'), 9)
      expect(stepX / walkStep('dustbot')).toBeCloseTo(toSquadX / toSquad, 3)
      expect(stepZ / walkStep('dustbot')).toBeCloseTo(toSquadZ / toSquad, 3)
    }
    expect(run.state.boss!.x).toBeGreaterThan(0)
  })

  it('enemies_alive_when_the_squad_reaches_the_arena_keep_coming', () => {
    // The second bulldog stands 30 units behind the first, so it is still ahead when the squad stops. 11 cats survive the
    // first and do not shoot the second down in time; in the arena it closes in at its own speed and still chases the
    // squad's centre across the track.
    const run = bossRun('dustbot', unbeatable, [
      { type: 'gates', z: 10, ...everyLane({ op: 'add', value: 10 }) },
      { type: 'wave', z: 299, enemy: 'bulldog', pattern: 'column', count: 2, x: 0, spacing: 30 },
    ])
    stepToArena(run)
    expect(run.state.enemies).toHaveLength(1)
    const start = { ...run.state.enemies[0] }
    expect(start.z).toBeGreaterThan(length)
    steerTo(run, -4)

    stepTicks(run, 19)

    expect(run.state.enemies).toHaveLength(1)
    expect(start.z - run.state.enemies[0].z).toBeCloseTo((20 * 2.5) / 60, 6)
    expect(run.state.enemies[0].x).toBeCloseTo(start.x - 20 * (6 / 60), 6)
  })
})

describe('boss HP', () => {
  // Expected squad at boss × 2 yarn balls/s × 1 damage × 1 yarn ball per shot × the boss HP time: 8 s for the Dustbot,
  // 20 s for the Mega Dustbot. 60 → 960 and 2,400 is the example in docs/domain/levels.md.
  it.each<[BossKind, number, number]>([
    ['dustbot', 60, 960],
    ['dustbot', 1, 16],
    ['dustbot', 25, 400],
    ['dustbot', 999, 15984],
    ['megaDustbot', 60, 2400],
    ['megaDustbot', 1, 40],
    ['megaDustbot', 999, 39960],
  ])('%s_with_an_expected_squad_of_%i_has_%i_hp', (boss, expectedSquadAtBoss, hp) => {
    const run = bossRun(boss, expectedSquadAtBoss)

    stepToArena(run)

    expect(run.state.boss).toEqual(expect.objectContaining({ hp, fullHp: hp }))
  })

  describe('with other base weapon values', () => {
    const baseWeapon = { ...tuning.cat }
    afterEach(() => Object.assign(tuning.cat, baseWeapon))

    // Every base value counts: 60 × 2 yarn balls/s × 2 damage × 3 yarn balls per shot × 8 s for the Dustbot, × 20 s for
    // the Mega Dustbot.
    it.each<[BossKind, number]>([
      ['dustbot', 5760],
      ['megaDustbot', 14400],
    ])('%s_hp_counts_the_base_damage_and_yarn_balls_per_shot', (boss, hp) => {
      tuning.cat.damage = 2
      tuning.cat.yarnBallsPerShot = 3
      const run = bossRun(boss, 60)

      stepToArena(run)

      expect(run.state.boss).toEqual(expect.objectContaining({ hp, fullHp: hp }))
    })
  })

  it('boss_hp_does_not_scale_with_the_level_number', () => {
    const run = bossRun('dustbot', 60, [], 1, 5)

    stepToArena(run)

    expect(run.state.boss).toEqual(expect.objectContaining({ hp: 960, fullHp: 960 }))
  })

  it('boss_hp_counts_the_base_weapon_values_not_the_buffs_taken_in_the_run', () => {
    const run = bossRun('dustbot', 60, [
      ...repeatedRows({ op: 'damage', value: 1 }, 2),
      ...repeatedRows({ op: 'fireRate', value: 20 }, 2, 20),
      ...repeatedRows({ op: 'multiShot', value: 1 }, 2, 35),
    ])

    stepToArena(run)

    expect(run.state.weapon).toEqual(expect.objectContaining({ damage: 3, yarnBallsPerShot: 3 }))
    expect(run.state.boss).toEqual(expect.objectContaining({ hp: 960, fullHp: 960 }))
  })
})

describe('hitting the boss', () => {
  it('each_yarn_ball_that_hits_takes_its_damage_from_the_boss', () => {
    const run = bossRun('dustbot', 60)
    stepToArena(run)
    const hpSeen = [960]
    const events: GameEvent[] = []

    for (let tick = 0; tick < 600; tick++) {
      events.push(...copied(run.step(noSteering)))
      const hp = run.state.boss!.hp
      if (hp !== hpSeen[hpSeen.length - 1]) hpSeen.push(hp)
    }

    expect(hpSeen.length).toBeGreaterThan(10)
    hpSeen.forEach((hp, index) => expect(hp).toBe(960 - index))
    expect(events.filter((event) => event.type === 'bossHit')).toHaveLength(960 - run.state.boss!.hp)
    expect(run.state.boss!.fullHp).toBe(960)
  })

  it('a_damage_buff_raises_the_damage_each_yarn_ball_deals_to_the_boss', () => {
    const run = bossRun('dustbot', 60, [{ type: 'gates', z: 20, ...everyLane({ op: 'damage', value: 1 }) }])
    stepToArena(run)

    const events = stepTicks(run, 600)

    const hits = events.filter((event) => event.type === 'bossHit').length
    expect(hits).toBeGreaterThan(5)
    expect(run.state.boss!.hp).toBe(960 - 2 * hits)
  })

  it('yarn_ball_standing_for_several_cats_deals_their_combined_damage_to_the_boss', () => {
    // 512 cats would have 1,024 yarn balls in flight, so each yarn ball stands for 3 cats.
    const run = bossRun('dustbot', 999, doublingRows(9))
    stepToArena(run)
    expect(run.state.squad.count).toBe(512)

    for (let tick = 0; tick < 300; tick++) {
      run.step(noSteering)
      expect((15984 - run.state.boss!.hp) % 3).toBe(0)
    }
    expect(run.state.boss!.hp).toBeLessThan(15984)
  })

  it.each<BossKind>(['dustbot', 'megaDustbot'])('yarn_balls_hit_the_%s_within_its_hit_radius', (boss) => {
    // A yarn ball flies 30 units from the cat at z = 300, so it first reaches the boss at 330 + both hit radii.
    const firstReach = length + 30 + yarnBallRadius + hitRadius[boss]
    const run = bossRun(boss, unbeatable)
    stepToArena(run)

    stepUntil(run, (state) => state.boss!.hp < state.boss!.fullHp, 300)

    expect(run.state.boss!.hp).toBe(run.state.boss!.fullHp - 1)
    // Cats fire every 0.5 s, in which the boss walks half its walk speed.
    expect(run.state.boss!.z).toBeLessThanOrEqual(firstReach + walkStep(boss))
    expect(run.state.boss!.z).toBeGreaterThan(firstReach - walkSpeed[boss] / 2 - 2 * walkStep(boss))
  })

  it.each<BossKind>(['dustbot', 'megaDustbot'])('%s_stops_every_yarn_ball_that_comes_within_reach', (boss) => {
    // After a tick no yarn ball is left within both hit radii of the boss, less the step the boss walks after the hits.
    const reach = yarnBallRadius + hitRadius[boss] - walkStep(boss) - 1e-9
    const run = bossRun(boss, unbeatable, doublingRows(3))
    stepToArena(run)
    stepTicks(run, 120)

    for (let tick = 0; tick < 300; tick++) {
      run.step(noSteering)
      const { x, z } = run.state.boss!
      for (const yarnBall of run.state.yarnBalls) {
        expect(yarnBall.z).toBeLessThan(z)
        expect(Math.hypot(yarnBall.x - x, yarnBall.z - z)).toBeGreaterThanOrEqual(reach)
      }
    }
    expect(run.state.boss!.hp).toBeLessThan(run.state.boss!.fullHp)
  })
})

describe('boss defeated', () => {
  it('run_is_won_when_the_boss_hp_reaches_0', () => {
    // 1 cat deals 2 damage per second, so a boss of 16 HP falls long before it walks the 32.7 units to the cat.
    const run = bossRun('dustbot', 1)
    stepToArena(run)

    const events = stepUntil(run, () => false, 1200)

    expect(run.state.status).toBe('won')
    expect(run.state.boss!.hp).toBeLessThanOrEqual(0)
    expect(events.filter((event) => event.type === 'bossHit')).toHaveLength(16)
    expect(events.filter((event) => event.type === 'bossDefeated')).toEqual([{ type: 'bossDefeated', boss: 'dustbot' }])
    expect(nearestCatDistance(run.state)).toBeGreaterThan(hitRadius.dustbot + catRadius)
  })

  it('run_is_still_running_while_the_boss_has_hp_left', () => {
    const run = bossRun('dustbot', 1)
    stepToArena(run)

    stepUntil(run, (state) => state.boss!.hp <= 1, 1200)

    expect(run.state.boss!.hp).toBe(1)
    expect(run.state.status).toBe('running')
  })
})

describe('boss touching the squad', () => {
  it('run_is_lost_when_the_dustbot_reaches_a_lone_cat', () => {
    // The boss walks 35 − 2 − 0.3 = 32.7 units at 1.5 units/s: 21.8 s, or 1308 ticks.
    const run = bossRun('dustbot', unbeatable)
    stepToArena(run)

    stepTicks(run, 1300)
    expect(run.state.status).toBe('running')

    stepTicks(run, 12)
    expect(run.state.status).toBe('lost')
  })

  it.each<BossKind>(['dustbot', 'megaDustbot'])('run_is_lost_when_the_%s_comes_within_reach_of_a_cat_whatever_the_squad_count', (boss) => {
    const reach = hitRadius[boss] + catRadius
    const run = bossRun(boss, unbeatable, doublingRows(6))
    stepToArena(run)
    const distances: number[] = []
    let countBefore = 0

    while (run.state.status === 'running' && distances.length < 3000) {
      countBefore = run.state.squad.count
      run.step(noSteering)
      distances.push(nearestCatDistance(run.state))
    }

    expect(run.state.status).toBe('lost')
    expect(countBefore).toBeGreaterThan(30)
    expect(distances.at(-1)).toBeLessThanOrEqual(reach + 1e-9)
    expect(distances.at(-3)).toBeGreaterThan(reach)
  })
})

// The defeat screen names the boss when it caught the squad, instead of "Out of cats".
describe('loss cause', () => {
  it('run_has_no_loss_cause_while_it_runs_in_the_arena', () => {
    const run = bossRun('dustbot', unbeatable)
    stepToArena(run)

    stepTicks(run, 60)

    expect(run.state.status).toBe('running')
    expect(run.state.lossCause).toBeNull()
  })

  it.each<BossKind>(['dustbot', 'megaDustbot'])('run_lost_to_the_%s_touching_the_squad_is_caught_by_the_boss', (boss) => {
    const run = bossRun(boss, unbeatable, doublingRows(6))
    stepToArena(run)

    stepTicks(run, 3000)

    expect(run.state.status).toBe('lost')
    expect(run.state.squad.count).toBeGreaterThan(0)
    expect(run.state.lossCause).toBe('caughtByBoss')
    expect(run.state.boss!.kind).toBe(boss)
  })

  it('run_won_against_the_boss_has_no_loss_cause', () => {
    const run = bossRun('dustbot', 1)
    stepToArena(run)

    stepTicks(run, 1200)

    expect(run.state.status).toBe('won')
    expect(run.state.lossCause).toBeNull()
  })
})

describe('boss tick order', () => {
  // 16 cats with 16 damage gates deal 17 damage a hit, more than the 16 HP one step of expected squad adds, so a boss HP can be
  // picked that falls exactly in the tick the boss reaches the squad.
  const squadEvents: Level['events'] = [...doublingRows(4), ...repeatedRows({ op: 'damage', value: 1 }, 16, 45)]

  function damageUntilLost(seed: number): number[] {
    const run = bossRun('dustbot', unbeatable, squadEvents, seed)
    stepToArena(run)
    const damage: number[] = []
    while (run.state.status === 'running' && damage.length < 3000) {
      run.step(noSteering)
      damage.push(run.state.boss!.fullHp - run.state.boss!.hp)
    }
    return damage
  }

  it('yarn_ball_that_defeats_the_boss_wins_even_if_the_boss_reaches_the_squad_in_the_same_tick', () => {
    // A seed whose run lands a hit in the tick the boss reaches the squad; with hits before contacts, one always does for some seed.
    let found: { seed: number; damage: number[] } | undefined
    for (let seed = 1; seed <= 40 && found === undefined; seed++) {
      const damage = damageUntilLost(seed)
      if (damage.length >= 2 && damage[damage.length - 1] > damage[damage.length - 2]) found = { seed, damage }
    }
    expect(found).toBeDefined()
    const { seed, damage } = found!
    const expectedSquadAtBoss = Math.floor(damage[damage.length - 1] / 16)

    const run = bossRun('dustbot', expectedSquadAtBoss, squadEvents, seed)
    stepToArena(run)
    stepTicks(run, damage.length - 1)
    expect(run.state.status).toBe('running')

    const events = copied(run.step(noSteering))

    expect(run.state.status).toBe('won')
    expect(events.filter((event) => event.type === 'bossDefeated')).toHaveLength(1)
  })
})
