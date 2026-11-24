import { afterEach, describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type EnemyKilledEvent, type GameEvent, type Run } from '../../src/sim/run'
import { copied, doublingRows, everyLane, levelOf, noSteering, repeatedRows, steerTo, stepTicks, stepUntil } from './runHarness'

type WaveEvent = Extract<Level['events'][number], { type: 'wave' }>
type EnemyKind = WaveEvent['enemy']
type Position = { x: number; z: number }

// Level 1 values from docs/domain/run.md.
const enemies: [EnemyKind, { hp: number; shield: number; speed: number; contactDamage: number }][] = [
  ['puppy', { hp: 3, shield: 0, speed: 4, contactDamage: 1 }],
  ['chihuahua', { hp: 1, shield: 0, speed: 9, contactDamage: 1 }],
  ['bulldog', { hp: 40, shield: 0, speed: 2.5, contactDamage: 10 }],
  ['shieldDog', { hp: 15, shield: 30, speed: 3, contactDamage: 3 }],
]

function spawnWave(wave: WaveEvent) {
  const run = createRun({ level: levelOf([wave]), seed: 1 })
  stepUntil(run, (state) => state.enemies.length > 0, 6000)
  return run
}

function expectPositions(actual: readonly Position[], expected: Position[], tolerance: number) {
  const byPlace = (a: Position, b: Position) => a.x - b.x || a.z - b.z
  const sortedActual = [...actual].sort(byPlace)
  const sortedExpected = [...expected].sort(byPlace)
  expect(sortedActual).toHaveLength(sortedExpected.length)
  sortedExpected.forEach((place, index) => {
    expect(Math.abs(sortedActual[index].x - place.x)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(sortedActual[index].z - place.z)).toBeLessThanOrEqual(tolerance)
  })
}

// At the spawn tick an enemy may already have taken one step, at most 9/60 units for a chihuahua.
const spawnTolerance = 0.2

describe('enemy kinds', () => {
  it.each(enemies)('%s_starts_with_its_hp_and_shield', (enemy, values) => {
    const run = spawnWave({ type: 'wave', z: 80, enemy, pattern: 'line', count: 3 })

    expect(run.state.enemies.map(({ kind, hp, shield }) => ({ kind, hp, shield }))).toEqual(
      Array.from({ length: 3 }, () => ({ kind: enemy, hp: values.hp, shield: values.shield })),
    )
  })

  const patterns: [WaveEvent['pattern'], (enemy: EnemyKind) => WaveEvent, Position[]][] = [
    ['line', (enemy) => ({ type: 'wave', z: 80, enemy, pattern: 'line', count: 5 }), [-4, -2, 0, 2, 4].map((x) => ({ x, z: 80 }))],
    [
      'block',
      (enemy) => ({ type: 'wave', z: 130, enemy, pattern: 'block', columns: 3, rows: 2, x: 1, spacing: 1.5 }),
      [130, 131.5].flatMap((z) => [-0.5, 1, 2.5].map((x) => ({ x, z }))),
    ],
    [
      'column',
      (enemy) => ({ type: 'wave', z: 180, enemy, pattern: 'column', count: 4, x: -3, spacing: 2 }),
      [180, 182, 184, 186].map((z) => ({ x: -3, z })),
    ],
    [
      'flank',
      (enemy) => ({ type: 'wave', z: 230, enemy, pattern: 'flank', count: 2, spacing: 2 }),
      [-5, 5].flatMap((x) => [230, 232].map((z) => ({ x, z }))),
    ],
  ]

  describe.each(enemies.map(([enemy]) => enemy))('%s', (enemy) => {
    it.each(patterns)('comes_in_the_%s_pattern', (_pattern, wave, expected) => {
      const run = spawnWave(wave(enemy))

      expectPositions(run.state.enemies, expected, spawnTolerance)
      for (const spawned of run.state.enemies) expect(spawned.kind).toBe(enemy)
    })
  })
})

describe('enemy movement', () => {
  const chaseStep = tuning.enemyChaseSpeed / 60

  it.each(enemies)('%s_runs_along_the_road_toward_the_squad_at_its_speed', (enemy, { speed }) => {
    const run = spawnWave({ type: 'wave', z: 50, enemy, pattern: 'column', count: 1, x: 0, spacing: 1 })
    const start = { ...run.state.enemies[0] }

    stepTicks(run, 30)

    expect(run.state.enemies[0].z).toBeCloseTo(start.z - speed / 2, 6)
    expect(run.state.enemies[0].x).toBe(0)
  })

  it.each(enemies)('%s_moves_across_the_track_toward_the_squad_centre_at_6_units_per_second', (enemy, { speed }) => {
    const run = spawnWave({ type: 'wave', z: 50, enemy, pattern: 'column', count: 1, x: 4, spacing: 1 })
    const start = { ...run.state.enemies[0] }

    stepTicks(run, 30)

    // Across the track at the chase speed, while along the road it keeps its own speed.
    expect(run.state.enemies[0].x).toBeCloseTo(start.x - 3, 6)
    expect(run.state.enemies[0].z).toBeCloseTo(start.z - speed / 2, 6)
  })

  it('enemy_stops_exactly_at_the_squad_centre_x_and_does_not_overshoot', () => {
    const run = spawnWave({ type: 'wave', z: 50, enemy: 'bulldog', pattern: 'column', count: 1, x: 4, spacing: 1 })
    let x = run.state.enemies[0].x

    // 4 units at 0.1 a tick take 40 ticks.
    for (let tick = 0; tick < 60; tick++) {
      run.step(noSteering)
      const next = run.state.enemies[0].x
      expect(next).toBeGreaterThanOrEqual(0)
      expect(next).toBeLessThanOrEqual(x)
      x = next
    }

    expect(x).toBe(run.state.squad.x)
  })

  it('enemy_follows_the_squad_centre_as_the_squad_steers', () => {
    const run = spawnWave({ type: 'wave', z: 60, enemy: 'bulldog', pattern: 'column', count: 1, x: 0, spacing: 1 })
    steerTo(run, -4)
    stepTicks(run, 20)
    const before = run.state.enemies[0].x

    stepTicks(run, 10)

    expect(run.state.enemies[0].x).toBeCloseTo(before - 10 * chaseStep, 6)
  })

  describe('with no speed growth in the tuning config', () => {
    const documentedGrowth = tuning.scaling.speedGrowth

    afterEach(() => {
      tuning.scaling.speedGrowth = documentedGrowth
    })

    it('chihuahua_from_one_track_edge_reaches_a_squad_at_the_other', () => {
      // The binding case of docs/domain/run.md: the fastest kind closes the 40 units in 40 ÷ (12 + 9) ≈ 1.9 s and in that time
      // moves up to 11.4 units across, more than the 10 units of the track. On level 30 a chihuahua has 1.08^29 ≈ 9.3 HP,
      // which the few yarn balls 1 cat lands in that time do not break, and the column of 1 grows to 4. Without speed growth,
      // level 30 runs at the speed of level 1, so the case stays as tight as there.
      tuning.scaling.speedGrowth = 0
      const run = createRun({
        level: levelOf([{ type: 'wave', z: 100, enemy: 'chihuahua', pattern: 'column', count: 1, x: -5, spacing: 1 }], 300, 30),
        seed: 1,
      })
      steerTo(run, 5)
      stepUntil(run, (state) => state.enemies.length > 0, 6000)
      expect(run.state.squad.x).toBeCloseTo(5, 6)
      let ticks = 0

      const events = stepUntil(
        run,
        () => {
          ticks++
          return false
        },
        600,
      )

      // It has crossed the whole track and touches the squad on its line.
      expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([
        expect.objectContaining({ type: 'enemyKilled', enemy: 'chihuahua', cause: 'contact', x: run.state.squad.x }),
      ])
      expect(run.state.lossCause).toBe('outOfCats')
      expect(ticks / 60).toBeGreaterThan(1.7)
      expect(ticks / 60).toBeLessThan(2)
    })
  })

  it('bulldog_from_the_left_lane_reaches_a_squad_in_the_right_lane', () => {
    // As the puppy example in docs/domain/run.md, with a bulldog whose 40 HP outlast the shots of 1 cat. It crosses the
    // 20/3 units in about 1.1 s and touches the squad when about 0.9 units away, (40 − 0.9) ÷ (12 + 2.5) ≈ 2.7 s after it appeared.
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 100, enemy: 'bulldog', pattern: 'column', count: 1, x: -10 / 3, spacing: 1 }]),
      seed: 1,
    })
    steerTo(run, 10 / 3)
    stepUntil(run, (state) => state.enemies.length > 0, 6000)
    let ticks = 0
    let caughtUpAt: number | undefined

    const events = stepUntil(
      run,
      (state) => {
        if (caughtUpAt === undefined && state.enemies[0]?.x === state.squad.x) caughtUpAt = ticks
        ticks++
        return false
      },
      600,
    )

    expect(caughtUpAt).toBeGreaterThanOrEqual(64)
    expect(caughtUpAt).toBeLessThanOrEqual(68)
    expect(ticks / 60).toBeGreaterThan(2.6)
    expect(ticks / 60).toBeLessThan(2.8)
    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([
      expect.objectContaining({ type: 'enemyKilled', enemy: 'bulldog', cause: 'contact' }),
    ])
    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('outOfCats')
  })

  it.each(enemies)('flank_%s_chases_the_squad_centre_from_its_first_tick', (enemy, { speed }) => {
    const run = spawnWave({ type: 'wave', z: 50, enemy, pattern: 'flank', count: 1, spacing: 1 })
    const [leftStart, rightStart] = [...run.state.enemies].sort((a, b) => a.x - b.x).map((spawned) => ({ ...spawned }))

    stepTicks(run, 30)

    // Straight across at the chase speed and along the road at its own speed, not inward at 45°.
    const [left, right] = [...run.state.enemies].sort((a, b) => a.x - b.x)
    expect(left.x).toBeCloseTo(leftStart.x + 3, 6)
    expect(right.x).toBeCloseTo(rightStart.x - 3, 6)
    expect(left.z).toBeCloseTo(leftStart.z - speed / 2, 6)
    expect(right.z).toBeCloseTo(rightStart.z - speed / 2, 6)
  })

  // Enemies whose HP outlast the shots of 1 cat; a squad that only steers away from one still gets touched.
  it.each(['bulldog', 'shieldDog'] as const)('squad_that_only_steers_away_from_a_%s_still_gets_touched', (enemy) => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 100, enemy, pattern: 'column', count: 1, x: -4, spacing: 1 }]),
      seed: 1,
    })
    const awayFromTheEnemy = () => {
      const chaser = run.state.enemies[0]
      const enemyIsLeft = chaser === undefined || chaser.x <= run.state.squad.x
      return { drag: 0, left: !enemyIsLeft, right: enemyIsLeft }
    }

    const events = stepUntil(run, () => false, 6000, awayFromTheEnemy)

    expect(run.state.squad.x).toBeGreaterThan(4)
    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([expect.objectContaining({ type: 'enemyKilled', enemy, cause: 'contact' })])
    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('outOfCats')
  })

  // A squad of 4 at x = −4 waits for a bulldog in its lane and jumps to x = 4 when the bulldog is 2 units ahead,
  // faster than the bulldog can follow, so the bulldog ends up behind the squad's centre without touching a cat.
  function dodgedBulldog() {
    const run = createRun({
      level: levelOf([...doublingRows(2), { type: 'wave', z: 100, enemy: 'bulldog', pattern: 'column', count: 1, x: -4, spacing: 1 }]),
      seed: 1,
    })
    steerTo(run, -4)
    stepUntil(run, (state) => state.enemies.length > 0 && state.enemies[0].z - state.squad.z < 2, 6000)
    steerTo(run, 4)
    return run
  }

  it('enemy_behind_the_squad_centre_runs_back_toward_it_at_its_speed', () => {
    const run = dodgedBulldog()
    let ticksBehind = 0

    while (run.state.status === 'running' && run.state.enemies.length > 0 && run.state.squad.z < 100) {
      const before = { ...run.state.enemies[0] }
      const behindTheCentre = before.z < run.state.squad.z
      run.step(noSteering)
      const bulldog = run.state.enemies[0]
      if (!behindTheCentre || bulldog === undefined) continue
      ticksBehind++
      expect(bulldog.z).toBeCloseTo(before.z + 2.5 / 60, 9)
      expect(bulldog.x).toBeCloseTo(before.x + chaseStep, 9)
    }

    expect(ticksBehind).toBeGreaterThan(0)
  })

  it('enemy_behind_the_squad_centre_costs_cats_until_past_the_last_cat', () => {
    // A squad of 4 at x = −4 waits for a shield dog in its lane, whose 45 HP outlast the shots of 4 cats, and steps aside
    // when the shield dog is `gap` units ahead. Some steps let it pass the squad's centre, and some even the last cat's hit
    // circle, before it reaches a cat: still touching that cat, it is not past the last cat yet.
    const runStep = tuning.squad.forwardSpeed / 60
    const contacts: { behindTheCentre: boolean; behindTheLastCatBy: number; events: GameEvent[]; squadCount: number; status: string }[] = []
    for (let gap = 1.2; gap <= 1.6; gap += 0.05) {
      for (let step = 1.4; step <= 1.8; step += 0.05) {
        const run = createRun({
          level: levelOf([...doublingRows(2), { type: 'wave', z: 100, enemy: 'shieldDog', pattern: 'column', count: 1, x: -4, spacing: 1 }]),
          seed: 1,
        })
        steerTo(run, -4)
        stepUntil(run, (state) => state.enemies.length > 0 && state.enemies[0].z - state.squad.z < gap, 6000)
        steerTo(run, -4 + step)
        while (run.state.status === 'running' && run.state.enemies.length > 0 && run.state.squad.z < 100) {
          // Where the last cat stands in the coming tick, before a contact shrinks the squad.
          const lastCatZ = Math.min(...run.state.cats.map((cat) => cat.z)) + runStep
          const events = copied(run.step(noSteering))
          const contact = events.find((event): event is EnemyKilledEvent => event.type === 'enemyKilled' && event.cause === 'contact')
          if (contact === undefined) continue
          contacts.push({
            behindTheCentre: contact.z < run.state.squad.z,
            behindTheLastCatBy: lastCatZ - contact.z,
            events,
            squadCount: run.state.squad.count,
            status: run.state.status,
          })
          break
        }
      }
    }
    const behind = contacts.filter((contact) => contact.behindTheCentre)

    expect(behind.length).toBeGreaterThan(0)
    expect(behind.some((contact) => contact.behindTheLastCatBy > tuning.hitRadius.cat)).toBe(true)
    for (const { events, squadCount, status } of behind) {
      expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: 3 }])
      expect(squadCount).toBe(1)
      expect(status).toBe('running')
    }
  })

  it('enemy_that_gets_past_the_squad_disappears_without_damage', () => {
    const run = dodgedBulldog()

    const events = stepUntil(run, (state) => state.enemies.length === 0, 120)

    expect(run.state.enemies).toHaveLength(0)
    expect(run.state.squad.count).toBe(4)
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([])
  })

  it('enemies_run_through_walls_barrels_and_each_other_at_their_own_speed', () => {
    // The puppy catches up with the bulldog and both run through the barrel and the wall on the squad's line. The wall
    // stops the squad's yarn balls, and the squad is still before it when the test ends.
    const run = createRun({
      level: levelOf([
        { type: 'wall', z: 56, x: 0, width: 2 },
        { type: 'barrel', z: 57.5, x: 0 },
        { type: 'wave', z: 60, enemy: 'bulldog', pattern: 'column', count: 1, x: 0, spacing: 1 },
        { type: 'wave', z: 62, enemy: 'puppy', pattern: 'column', count: 1, x: 0, spacing: 1 },
      ]),
      seed: 1,
    })
    stepUntil(run, (state) => state.enemies.length === 2, 6000)
    const speeds: Record<string, number> = { puppy: 4, bulldog: 2.5 }
    const zOf = (kind: string) => run.state.enemies.find((enemy) => enemy.kind === kind)?.z ?? NaN
    let puppyPassedBulldog = false

    for (let tick = 0; tick < 120; tick++) {
      const before = { puppy: zOf('puppy'), bulldog: zOf('bulldog') }
      run.step(noSteering)
      for (const kind of ['puppy', 'bulldog'] as const) expect(zOf(kind)).toBeCloseTo(before[kind] - speeds[kind] / 60, 9)
      for (const enemy of run.state.enemies) expect(enemy.x).toBe(0)
      if (zOf('puppy') < zOf('bulldog')) puppyPassedBulldog = true
    }

    expect(puppyPassedBulldog).toBe(true)
    expect(Math.max(zOf('puppy'), zOf('bulldog'))).toBeLessThan(56)
    expect(run.state.squad.z).toBeLessThan(56)
  })

  it('never_more_than_150_enemies_are_alive', () => {
    const run = createRun({
      level: levelOf([
        { type: 'wave', z: 60, enemy: 'chihuahua', pattern: 'block', columns: 10, rows: 10, x: 0, spacing: 1 },
        { type: 'wave', z: 61, enemy: 'bulldog', pattern: 'block', columns: 10, rows: 10, x: 0, spacing: 1 },
      ]),
      seed: 1,
    })
    let mostAlive = 0

    while (run.state.status === 'running' && run.state.squad.z < 40) {
      run.step(noSteering)
      mostAlive = Math.max(mostAlive, run.state.enemies.length)
    }

    expect(mostAlive).toBe(150)
  })

  it('enemies_that_would_spawn_beyond_the_cap_are_dropped_and_those_alive_stay', () => {
    // 100 chihuahuas are alive when the bulldogs appear, before any yarn ball reaches them: only 50 bulldogs fit.
    const run = createRun({
      level: levelOf([
        { type: 'wave', z: 60, enemy: 'chihuahua', pattern: 'block', columns: 10, rows: 10, x: 0, spacing: 1 },
        { type: 'wave', z: 61, enemy: 'bulldog', pattern: 'block', columns: 10, rows: 10, x: 0, spacing: 1 },
      ]),
      seed: 1,
    })

    stepUntil(run, (state) => state.squad.z > 22, 6000)

    expect(run.state.enemies.filter((enemy) => enemy.kind === 'chihuahua')).toHaveLength(100)
    expect(run.state.enemies.filter((enemy) => enemy.kind === 'bulldog')).toHaveLength(50)
  })
})

describe('enemy contact', () => {
  // A column of enemies, 2 units apart, comes at a squad of 1 + `add` cats; the cats shoot down the front ones,
  // and the first to reach the squad touches it alone.
  function firstContact(enemy: EnemyKind, add: number, count: number) {
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 10, ...everyLane({ op: 'add', value: add }) },
        { type: 'wave', z: 100, enemy, pattern: 'column', count, x: 0, spacing: 2 },
      ]),
      seed: 1,
    })
    stepUntil(run, (state) => state.squad.z > 11, 6000)
    const squadBefore = run.state.squad.count
    let events: GameEvent[] = []
    while (run.state.status === 'running' && run.state.squad.z < 100) {
      events = copied(run.step(noSteering))
      if (events.some((event) => event.type === 'catsLost')) break
    }
    return { run, squadBefore, events }
  }

  it.each([
    ['bulldog', 10],
    ['shieldDog', 3],
  ] as const)('%s_touching_a_squad_of_25_dies_and_takes_its_contact_damage', (enemy, contactDamage) => {
    const { run, squadBefore, events } = firstContact(enemy, 24, 8)

    expect(squadBefore).toBe(25)
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: contactDamage }])
    expect(events.filter((event) => event.type === 'enemyKilled' && event.cause === 'contact')).toEqual([
      expect.objectContaining({ type: 'enemyKilled', enemy, cause: 'contact' }),
    ])
    expect(run.state.squad.count).toBe(25 - contactDamage)
    expect(run.state.status).toBe('running')
  })

  it('bulldog_touching_a_squad_of_6_leaves_0_and_loses_the_run', () => {
    const { run, squadBefore, events } = firstContact('bulldog', 5, 1)

    expect(squadBefore).toBe(6)
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: 6 }])
    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
  })

  it('each_chihuahua_touching_the_squad_dies_and_removes_exactly_1_cat', () => {
    const run = createRun({
      level: levelOf([
        ...doublingRows(3),
        { type: 'wave', z: 100, enemy: 'chihuahua', pattern: 'column', count: 80, x: -2.5, spacing: 0.25 },
      ]),
      seed: 1,
    })
    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.z > 31, 6000)
    expect(run.state.squad.count).toBe(8)

    const events: GameEvent[] = stepUntil(run, (state) => state.squad.z > 110, 6000)
    const catsLost = events.filter((event) => event.type === 'catsLost')
    const contactKills = events.filter((event) => event.type === 'enemyKilled' && event.cause === 'contact')

    expect(contactKills.length).toBeGreaterThan(0)
    expect(catsLost).toHaveLength(contactKills.length)
    for (const event of catsLost) expect(event).toEqual({ type: 'catsLost', count: 1 })
    expect(run.state.squad.count).toBe(8 - contactKills.length)
  })
})

describe('shot enemies', () => {
  it('chihuahua_dies_from_one_yarn_ball', () => {
    const run = spawnWave({ type: 'wave', z: 60, enemy: 'chihuahua', pattern: 'line', count: 1 })
    const hpSeen = new Set<number>()
    const events: GameEvent[] = []

    while (run.state.enemies.length > 0 && run.state.status === 'running') {
      events.push(...copied(run.step(noSteering)))
      for (const enemy of run.state.enemies) hpSeen.add(enemy.hp)
    }

    expect([...hpSeen]).toEqual([1])
    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([
      expect.objectContaining({ type: 'enemyKilled', enemy: 'chihuahua', cause: 'shot' }),
    ])
    expect(run.state.squad.count).toBe(1)
  })
})

describe('shield dog', () => {
  // 8 cats with 3 damage gates fire yarn balls of 4 damage. The shield goes 30 → 26 → … → 2, then a
  // yarn ball breaks it and deals the 2 left over to the body: 15 → 13 → 9 → 5 → 1 → killed.
  const expectedShieldThenBody = [
    ...[30, 26, 22, 18, 14, 10, 6, 2].map((shield) => `${shield}/15`),
    ...[13, 9, 5, 1].map((hp) => `0/${hp}`),
  ]

  function watchShieldDog(run: Run) {
    stepUntil(run, (state) => state.enemies.length > 0, 6000)
    const seen: string[] = []
    const events: GameEvent[] = []
    while (run.state.enemies.length > 0 && run.state.status === 'running') {
      const [shieldDog] = run.state.enemies
      if (seen.at(-1) !== `${shieldDog.shield}/${shieldDog.hp}`) seen.push(`${shieldDog.shield}/${shieldDog.hp}`)
      events.push(...copied(run.step(noSteering)))
    }
    return { seen, events }
  }

  it('shield_takes_all_damage_and_passes_what_is_left_over_to_the_body', () => {
    const run = createRun({
      level: levelOf([
        ...repeatedRows({ op: 'damage', value: 1 }, 3),
        ...repeatedRows({ op: 'multiply', value: 2 }, 3, 20),
        { type: 'wave', z: 110, enemy: 'shieldDog', pattern: 'line', count: 1 },
      ]),
      seed: 1,
    })

    const { seen, events } = watchShieldDog(run)

    expect(run.state.squad.count).toBe(8)
    expect(seen[0]).toBe('30/15')
    expect(seen.filter((state) => !expectedShieldThenBody.includes(state))).toEqual([])
    expect(seen.some((state) => state.startsWith('0/'))).toBe(true)
    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([
      expect.objectContaining({ type: 'enemyKilled', enemy: 'shieldDog', cause: 'shot' }),
    ])
  })

  it('body_keeps_its_hp_while_the_shield_holds', () => {
    // 1 cat lands about 5 hits, far from breaking a shield of 30
    const run = createRun({ level: levelOf([{ type: 'wave', z: 60, enemy: 'shieldDog', pattern: 'line', count: 1 }]), seed: 1 })

    const { seen } = watchShieldDog(run)

    expect(seen.length).toBeGreaterThan(1)
    seen.forEach((state, index) => expect(state).toBe(`${30 - index}/15`))
  })
})
