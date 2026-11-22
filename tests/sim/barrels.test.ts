import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type GameEvent } from '../../src/sim/run'
import { copied, levelOf, noSteering, repeatedRows, steerTo, stepUntil } from './runHarness'

type EnemyKind = Extract<Level['events'][number], { type: 'wave' }>['enemy']

describe('barrel', () => {
  it('barrel_stands_where_the_level_puts_it_with_10_hp_from_the_start', () => {
    const run = createRun({ level: levelOf([{ type: 'barrel', z: 120, x: 1.5 }]), seed: 1 })

    expect(run.state.barrels).toEqual([expect.objectContaining({ x: 1.5, z: 120, hp: 10 })])
  })

  it('barrel_hp_does_not_scale_with_the_level_number', () => {
    const run = createRun({ level: levelOf([{ type: 'barrel', z: 120, x: 1.5 }], 300, 5), seed: 1 })

    expect(run.state.barrels[0].hp).toBe(10)
  })

  it('each_yarn_ball_takes_1_hp_from_a_barrel', () => {
    const run = createRun({ level: levelOf([{ type: 'barrel', z: 60, x: 0 }]), seed: 1 })
    const hpSeen = [10]

    while (run.state.squad.z < 59 && run.state.status === 'running') {
      run.step(noSteering)
      const hp = run.state.barrels[0].hp
      if (hp !== hpSeen[hpSeen.length - 1]) hpSeen.push(hp)
    }

    expect(hpSeen.length).toBeGreaterThan(1)
    hpSeen.forEach((hp, index) => expect(hp).toBe(10 - index))
  })

  it('squad_passes_a_barrel_without_losing_cats_and_the_barrel_stays_until_past_the_last_cat', () => {
    // 1 cat lands about 7.5 hits, so the barrel is still standing when the squad reaches it
    const run = createRun({ level: levelOf([{ type: 'barrel', z: 60, x: 0 }]), seed: 1 })

    const events = stepUntil(run, (state) => state.squad.z >= 60, 6000)
    expect(run.state.barrels).toHaveLength(1)

    events.push(...stepUntil(run, (state) => state.squad.z > 62, 6000))
    expect(run.state.barrels).toHaveLength(0)
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([])
    expect(events.filter((event) => event.type === 'barrelDestroyed')).toEqual([])
    expect(run.state.squad.count).toBe(1)
  })

  it('barrel_is_destroyed_when_its_hp_reaches_0', () => {
    // 8 cats land far more than 10 hits before they reach it
    const run = createRun({
      level: levelOf([...repeatedRows({ op: 'multiply', value: 2 }, 3), { type: 'barrel', z: 80, x: 0 }]),
      seed: 1,
    })

    const events = stepUntil(run, (state) => state.squad.z > 79, 6000)

    expect(run.state.barrels).toHaveLength(0)
    expect(events.filter((event) => event.type === 'barrelDestroyed')).toEqual([{ type: 'barrelDestroyed', x: 0, z: 80 }])
  })

  it('yarn_ball_stops_at_a_barrel_in_front_of_a_puppy', () => {
    const run = createRun({
      level: levelOf([
        { type: 'barrel', z: 50, x: -2.5 },
        { type: 'wave', z: 60, enemy: 'puppy', pattern: 'column', count: 1, x: -2.5, spacing: 1 },
      ]),
      seed: 1,
    })
    steerTo(run, -2.5)
    let puppyHitBehindTheBarrel = false
    let barrelHitWhilePuppyBehind = false

    while (run.state.squad.z < 45 && run.state.status === 'running') {
      run.step(noSteering)
      const puppy = run.state.enemies[0]
      if (puppy === undefined || puppy.z < 51) continue
      if (puppy.hp < 3) puppyHitBehindTheBarrel = true
      if ((run.state.barrels[0]?.hp ?? 0) < 10) barrelHitWhilePuppyBehind = true
    }

    expect(barrelHitWhilePuppyBehind).toBe(true)
    expect(puppyHitBehindTheBarrel).toBe(false)
  })
})

describe('barrel splash', () => {
  // One cat with 9 damage gates fires yarn balls of 10 damage, so its first yarn ball to reach the barrel
  // at x = −2.5, z = 110 destroys it, at about the time the squad is at z = 90. A column of 40 enemies,
  // 0.5 apart, comes down x = −1, out of the cat's line of fire, timed so that at that moment its front
  // is about 8 units before the barrel: some enemies stand within 3 units of the barrel, others do not.
  const barrel = { x: -2.5, z: 110 }

  function splashTick(enemy: EnemyKind, speed: number) {
    const closing = speed / 8
    const waveZ = (barrel.z - 8 + 130 * closing) / (1 + closing)
    const run = createRun({
      level: levelOf([
        ...repeatedRows({ op: 'damage', value: 1 }, 9),
        { type: 'barrel', z: barrel.z, x: barrel.x },
        { type: 'wave', z: waveZ, enemy, pattern: 'column', count: 40, x: -1, spacing: 0.5 },
      ]),
      seed: 1,
    })
    steerTo(run, barrel.x)

    while (run.state.status === 'running' && run.state.squad.z < barrel.z) {
      const before = run.state.enemies.map(({ z, hp, shield }) => ({ z, hp, shield }))
      const events = copied(run.step(noSteering))
      if (events.some((event) => event.type === 'barrelDestroyed')) {
        // Enemies move after collisions, so each one is found again one step of its speed nearer.
        const after = (z: number) => run.state.enemies.find((moved) => Math.abs(moved.z - (z - speed / 60)) < 1e-6)
        const distance = (z: number) => Math.hypot(-1 - barrel.x, z - barrel.z)
        const clear = before.filter(({ z }) => Math.abs(distance(z) - 3) > 0.01)
        return {
          events,
          inside: clear.filter(({ z }) => distance(z) < 3).map((enemy) => ({ before: enemy, after: after(enemy.z) })),
          outside: clear.filter(({ z }) => distance(z) > 3).map((enemy) => ({ before: enemy, after: after(enemy.z) })),
        }
      }
    }
    throw new Error('the barrel was not destroyed')
  }

  it.each([
    ['puppy', 4],
    ['chihuahua', 9],
  ] as const)('barrel_splash_kills_every_%s_within_3_units', (enemy, speed) => {
    const { events, inside, outside } = splashTick(enemy, speed)

    expect(inside.length).toBeGreaterThan(0)
    expect(outside.length).toBeGreaterThan(0)
    for (const { after } of inside) expect(after).toBeUndefined()
    for (const { before, after } of outside) expect(after?.hp).toBe(before.hp)
    const kills = events.filter((event) => event.type === 'enemyKilled')
    expect(kills).toHaveLength(inside.length)
    for (const kill of kills) expect(kill).toMatchObject({ enemy, cause: 'barrel' })
  })

  it('barrel_splash_deals_30_damage_to_a_bulldog_within_3_units', () => {
    const { inside, outside } = splashTick('bulldog', 2.5)

    expect(inside.length).toBeGreaterThan(0)
    for (const { after } of inside) expect(after?.hp).toBe(10)
    for (const { after } of outside) expect(after?.hp).toBe(40)
  })

  it('barrel_splash_breaks_the_shield_of_a_shield_dog_within_3_units', () => {
    // 30 damage against a shield of 30 leaves the body at 15
    const { inside, outside } = splashTick('shieldDog', 3)

    expect(inside.length).toBeGreaterThan(0)
    for (const { after } of inside) expect(after).toMatchObject({ shield: 0, hp: 15 })
    for (const { after } of outside) expect(after).toMatchObject({ shield: 30, hp: 15 })
  })

  it('barrel_splash_does_not_damage_another_barrel', () => {
    const run = createRun({
      level: levelOf([
        ...repeatedRows({ op: 'damage', value: 1 }, 9),
        { type: 'barrel', z: 110, x: -2.5 },
        { type: 'barrel', z: 111, x: -1 },
      ]),
      seed: 1,
    })
    steerTo(run, -2.5)

    const events: GameEvent[] = stepUntil(run, (state) => state.barrels.length < 2, 6000)

    expect(events.filter((event) => event.type === 'barrelDestroyed')).toEqual([{ type: 'barrelDestroyed', x: -2.5, z: 110 }])
    expect(run.state.barrels).toEqual([expect.objectContaining({ x: -1, z: 111, hp: 10 })])
  })
})
