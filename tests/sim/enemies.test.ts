import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { copied, doublingRows, levelOf, noSteering, repeatedRows, steerTo, stepTicks, stepUntil } from './runHarness'

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
  it.each(enemies)('%s_runs_straight_at_the_squad_at_its_speed', (enemy, { speed }) => {
    const run = spawnWave({ type: 'wave', z: 50, enemy, pattern: 'column', count: 1, x: 4, spacing: 1 })
    const start = { ...run.state.enemies[0] }

    stepTicks(run, 60)

    expect(run.state.enemies[0].z).toBeCloseTo(start.z - speed, 6)
    expect(run.state.enemies[0].x).toBe(start.x)
  })

  it.each(enemies)('flank_%s_walks_inward_at_45_degrees_at_its_speed', (enemy, { speed }) => {
    const run = spawnWave({ type: 'wave', z: 50, enemy, pattern: 'flank', count: 1, spacing: 1 })
    const [leftStart, rightStart] = [...run.state.enemies].sort((a, b) => a.x - b.x).map((spawned) => ({ ...spawned }))

    stepTicks(run, 30)

    // 0.5 s at its speed along 45° is 0.5 × speed / √2 across and along the track
    const step = (0.5 * speed) / Math.SQRT2
    const [left, right] = [...run.state.enemies].sort((a, b) => a.x - b.x)
    expect(left.x).toBeCloseTo(leftStart.x + step, 2)
    expect(left.z).toBeCloseTo(leftStart.z - step, 2)
    expect(right.x).toBeCloseTo(rightStart.x - step, 2)
    expect(right.z).toBeCloseTo(rightStart.z - step, 2)
  })

  it.each(enemies)('%s_that_gets_past_the_squad_disappears_without_damage', (enemy) => {
    const run = spawnWave({ type: 'wave', z: 50, enemy, pattern: 'column', count: 2, x: 4, spacing: 2 })

    const events = stepUntil(run, (state) => state.enemies.length === 0, 600)

    expect(run.state.enemies).toHaveLength(0)
    expect(run.state.squad.count).toBe(1)
    expect(events.filter((event) => event.type === 'catsLost')).toHaveLength(0)
  })

  it('enemies_run_through_walls_barrels_and_each_other_at_their_own_speed', () => {
    // The puppy catches up with the bulldog and both cross the barrel and the wall in their lane,
    // away from the squad's line of fire.
    const run = createRun({
      level: levelOf([
        { type: 'wall', z: 56, x: 4, width: 2 },
        { type: 'barrel', z: 57.5, x: 4 },
        { type: 'wave', z: 60, enemy: 'bulldog', pattern: 'column', count: 1, x: 4, spacing: 1 },
        { type: 'wave', z: 62, enemy: 'puppy', pattern: 'column', count: 1, x: 4, spacing: 1 },
      ]),
      seed: 1,
    })
    steerTo(run, -4)
    stepUntil(run, (state) => state.enemies.length === 2, 6000)
    const speeds: Record<string, number> = { puppy: 4, bulldog: 2.5 }
    const zOf = (kind: string) => run.state.enemies.find((enemy) => enemy.kind === kind)?.z ?? NaN
    let puppyPassedBulldog = false

    for (let tick = 0; tick < 150; tick++) {
      const before = { puppy: zOf('puppy'), bulldog: zOf('bulldog') }
      run.step(noSteering)
      for (const kind of ['puppy', 'bulldog'] as const) expect(zOf(kind)).toBeCloseTo(before[kind] - speeds[kind] / 60, 9)
      for (const enemy of run.state.enemies) expect(enemy.x).toBe(4)
      if (zOf('puppy') < zOf('bulldog')) puppyPassedBulldog = true
    }

    expect(puppyPassedBulldog).toBe(true)
    expect(Math.max(zOf('puppy'), zOf('bulldog'))).toBeLessThan(56)
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
})

describe('enemy contact', () => {
  // A squad of 1 + `add` cats waits at x = −2.5, out of reach of the enemy coming down x = 3, and steers into
  // its lane only once it is 2.5 units ahead, so the squad has no time to shoot it down.
  function lateContact(enemy: EnemyKind, add: number) {
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 10, left: { op: 'add', value: add }, right: { op: 'add', value: add } },
        { type: 'wave', z: 100, enemy, pattern: 'column', count: 1, x: 3, spacing: 1 },
      ]),
      seed: 1,
    })
    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.z > 11, 6000)
    const squadBefore = run.state.squad.count
    stepUntil(run, (state) => state.enemies.length > 0 && state.enemies[0].z - state.squad.z < 2.5, 6000)
    steerTo(run, 3)
    const events = stepUntil(run, (state) => state.squad.z > 100, 6000)
    return { run, squadBefore, events }
  }

  it.each([
    ['bulldog', 10],
    ['shieldDog', 3],
  ] as const)('%s_touching_a_squad_of_25_dies_and_takes_its_contact_damage', (enemy, contactDamage) => {
    const { run, squadBefore, events } = lateContact(enemy, 24)

    expect(squadBefore).toBe(25)
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: contactDamage }])
    expect(events.filter((event) => event.type === 'enemyKilled')).toEqual([
      expect.objectContaining({ type: 'enemyKilled', enemy, cause: 'contact' }),
    ])
    expect(run.state.squad.count).toBe(25 - contactDamage)
    expect(run.state.enemies).toHaveLength(0)
    expect(run.state.status).toBe('running')
  })

  it('bulldog_touching_a_squad_of_6_leaves_0_and_loses_the_run', () => {
    const { run, squadBefore, events } = lateContact('bulldog', 5)

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
