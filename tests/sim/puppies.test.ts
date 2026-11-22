import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type GameEvent } from '../../src/sim/run'
import { doublingRows, everyLane, levelOf, noSteering, steerTo, stepTicks, stepUntil } from './runHarness'

type WaveEvent = Extract<Level['events'][number], { type: 'wave' }>
type Position = { x: number; z: number }

function spawnWave(wave: WaveEvent) {
  const run = createRun({ level: levelOf([wave]), seed: 1 })
  stepUntil(run, (state) => state.enemies.length > 0, 6000)
  return run
}

function expectPositions(actual: readonly Position[], expected: Position[], tolerance: { x: number; z: number }) {
  const byPlace = (a: Position, b: Position) => a.x - b.x || a.z - b.z
  const sortedActual = [...actual].sort(byPlace)
  const sortedExpected = [...expected].sort(byPlace)
  expect(sortedActual).toHaveLength(sortedExpected.length)
  sortedExpected.forEach((place, index) => {
    expect(Math.abs(sortedActual[index].x - place.x)).toBeLessThanOrEqual(tolerance.x)
    expect(Math.abs(sortedActual[index].z - place.z)).toBeLessThanOrEqual(tolerance.z)
  })
}

// At the spawn tick a puppy may already have taken one step: 4/60 units along the road and up to 6/60 across.
const spawnTolerance = { x: 0.15, z: 0.15 }

describe('wave spawning', () => {
  it('wave_appears_when_the_squad_is_40_units_before_it', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 100, enemy: 'puppy', pattern: 'line', count: 1 }]),
      seed: 1,
    })

    stepUntil(run, (state) => state.squad.z >= 59.8, 6000)
    expect(run.state.enemies).toHaveLength(0)

    stepUntil(run, (state) => state.squad.z >= 60.2, 6000)
    expect(run.state.enemies).toHaveLength(1)
  })

  it('puppy_starts_with_3_hp', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 5 })

    expect(run.state.enemies.map((puppy) => puppy.hp)).toEqual([3, 3, 3, 3, 3])
  })

  it('line_spreads_its_puppies_evenly_across_the_track', () => {
    const run = spawnWave({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 5 })

    expectPositions(
      run.state.enemies,
      [-4, -2, 0, 2, 4].map((x) => ({ x, z: 80 })),
      spawnTolerance,
    )
  })

  it('block_places_rows_of_columns_spacing_apart_centred_on_x', () => {
    const run = spawnWave({
      type: 'wave',
      z: 130,
      enemy: 'puppy',
      pattern: 'block',
      columns: 5,
      rows: 4,
      x: 0,
      spacing: 1.5,
    })

    expectPositions(
      run.state.enemies,
      [130, 131.5, 133, 134.5].flatMap((z) => [-3, -1.5, 0, 1.5, 3].map((x) => ({ x, z }))),
      spawnTolerance,
    )
  })

  it('block_off_centre_is_centred_on_its_x', () => {
    const run = spawnWave({
      type: 'wave',
      z: 130,
      enemy: 'puppy',
      pattern: 'block',
      columns: 2,
      rows: 1,
      x: 2,
      spacing: 2,
    })

    expectPositions(run.state.enemies, [{ x: 1, z: 130 }, { x: 3, z: 130 }], spawnTolerance)
  })

  it('column_places_puppies_in_single_file_from_z_back', () => {
    const run = spawnWave({ type: 'wave', z: 180, enemy: 'puppy', pattern: 'column', count: 8, x: -3, spacing: 2 })

    expectPositions(
      run.state.enemies,
      [180, 182, 184, 186, 188, 190, 192, 194].map((z) => ({ x: -3, z })),
      spawnTolerance,
    )
  })

  it('flank_places_count_puppies_at_each_edge_from_z_back', () => {
    const run = spawnWave({ type: 'wave', z: 230, enemy: 'puppy', pattern: 'flank', count: 4, spacing: 2 })

    expectPositions(
      run.state.enemies,
      [-5, 5].flatMap((x) => [230, 232, 234, 236].map((z) => ({ x, z }))),
      spawnTolerance,
    )
  })
})

describe('puppy movement', () => {
  it('puppy_runs_along_the_road_toward_the_squad_at_4_units_per_second', () => {
    const run = spawnWave({ type: 'wave', z: 50, enemy: 'puppy', pattern: 'column', count: 1, x: 0, spacing: 1 })
    const start = { ...run.state.enemies[0] }

    stepTicks(run, 30)

    expect(run.state.enemies[0].z).toBeCloseTo(start.z - 2, 6)
    expect(run.state.enemies[0].x).toBe(0)
  })
})

describe('puppy contact', () => {
  it('puppy_touching_a_squad_of_1_removes_the_cat_and_loses_the_run', () => {
    const run = createRun({
      level: levelOf([{ type: 'wave', z: 60, enemy: 'puppy', pattern: 'column', count: 8, x: 0, spacing: 1 }]),
      seed: 1,
    })

    const events = stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('lost')
    expect(run.state.squad.count).toBe(0)
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: 1 }])
    expect(events.filter((event) => event.type === 'enemyKilled' && event.cause === 'contact')).toHaveLength(1)
  })

  it('each_puppy_touching_the_squad_dies_and_removes_exactly_1_cat', () => {
    const double = { op: 'multiply', value: 2 } as const
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 10, ...everyLane(double) },
        { type: 'gates', z: 20, ...everyLane(double) },
        { type: 'gates', z: 30, ...everyLane(double) },
        { type: 'wave', z: 100, enemy: 'puppy', pattern: 'column', count: 80, x: -2.5, spacing: 0.25 },
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

  it('puppy_touching_a_cat_does_not_lose_a_run_with_cats_left', () => {
    const run = createRun({
      level: levelOf([...doublingRows(3), { type: 'wave', z: 100, enemy: 'puppy', pattern: 'column', count: 80, x: 0, spacing: 0.25 }]),
      seed: 1,
    })

    while (run.state.status === 'running' && run.state.squad.z < 110) {
      const events = run.step(noSteering)
      if (events.some((event) => event.type === 'catsLost') && run.state.squad.count > 0) {
        expect(run.state.status).toBe('running')
      }
    }
  })
})

describe('squad formation', () => {
  function formedSquad(doublings: number) {
    const run = createRun({ level: levelOf(doublingRows(doublings)), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 10 * doublings + 5, 6000)
    const { cats, squad } = run.state
    return { cats: cats.map((cat) => ({ x: cat.x - squad.x, z: cat.z - squad.z })), count: squad.count }
  }

  it('cats_stand_around_the_squad_with_the_first_cat_in_the_centre', () => {
    const { cats, count } = formedSquad(4)

    expect(cats).toHaveLength(count)
    expect(cats[0].x).toBeCloseTo(0, 6)
    expect(cats[0].z).toBeCloseTo(0, 6)
  })

  it('drawn_cats_match_the_squad_count_after_every_tick', () => {
    // At most 60 cats are drawn; the squad count shows the rest.
    const run = createRun({
      level: levelOf([
        ...doublingRows(6),
        { type: 'gates', z: 80, ...everyLane({ op: 'divide', value: 2 }) },
        { type: 'wave', z: 150, enemy: 'puppy', pattern: 'block', columns: 5, rows: 20, x: 0, spacing: 0.5 },
      ]),
      seed: 1,
    })

    let contacts = 0
    while (run.state.status === 'running' && run.state.squad.z < 150) {
      const events = run.step(noSteering)
      if (events.some((event) => event.type === 'catsLost')) contacts++
      expect(run.state.cats).toHaveLength(Math.min(run.state.squad.count, 60))
    }
    expect(contacts).toBeGreaterThan(0)
  })
})
