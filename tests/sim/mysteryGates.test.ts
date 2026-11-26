import { describe, expect, it } from 'vitest'
import type { Gate, GateFace, GateRowEvent, Level } from '../../src/content/level'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { copied, doublingRows, everyLane, levelOf, noSteering, steerTo, stepTicks, stepUntil } from './runHarness'

// requirements S-12 (3–4) and docs/domain/run.md "Mystery gates": a mystery gate shows "?" in purple; when the squad takes
// it, the option r × n rounded down applies, where r is the first number of the run's generator started from the gate's
// draw seed: the run's seed XOR ((row's place in events × 3 + lane number + 1) × 2654435769), on 32 bits.
//
// The expected options below were worked out from that rule for each seed and gate, with r written next to them.

const plusTenToForty: GateFace[] = [
  { op: 'add', value: 10 },
  { op: 'add', value: 20 },
  { op: 'add', value: 30 },
  { op: 'add', value: 40 },
]
const mystery = (options: GateFace[]): Gate => ({ op: 'mystery', options })

function gateRow(z: number, gates: Partial<Record<'left' | 'centre' | 'right', Gate>>): GateRowEvent {
  return { type: 'gates', z, ...gates }
}

function runWith(events: Level['events'], seed: number, stream?: Level['stream']): Run {
  return createRun({ level: levelOf(events, 300, 1, stream), seed })
}

function gatesTaken(events: readonly GameEvent[]) {
  return events.filter((event) => event.type === 'gateTaken')
}

// Steers to x and runs until the squad is 1 unit past z.
function runPast(run: Run, z: number, x = 0): GameEvent[] {
  if (x !== 0) steerTo(run, x)
  return stepUntil(run, (state) => state.squad.z > z + 1, 6000)
}

describe('mystery gate look', () => {
  it('mystery_gate_is_purple', () => {
    const run = runWith([gateRow(100, { centre: mystery(plusTenToForty) })], 1)

    expect(run.state.gateRows[0].centre).toMatchObject({ colour: 'purple' })
  })

  it('mystery_gate_stays_purple_as_the_run_goes_on', () => {
    const run = runWith([gateRow(100, { centre: mystery([{ op: 'add', value: 10 }, { op: 'subtract', value: 5 }]) })], 1)

    for (let tick = 0; tick < 200; tick++) {
      run.step(noSteering)
      expect(run.state.gateRows[0].centre).toMatchObject({ colour: 'purple' })
    }
  })
})

describe('mystery gate draw', () => {
  // A mystery gate in the centre lane of the first event has the key 0 × 3 + 1 + 1 = 2.
  it.each([
    [1, 30, 'r = 0.698'],
    [7, 40, 'r = 0.759'],
    [98765, 20, 'r = 0.457'],
    [1234, 30, 'r = 0.507'],
  ])('mystery_gate_taken_on_seed_%i_applies_plus_%i', (seed, value) => {
    const run = runWith([gateRow(10, { centre: mystery(plusTenToForty) })], seed)

    const events = runPast(run, 10)

    expect(run.state.squad.count).toBe(1 + value)
    expect(gatesTaken(events)).toEqual([expect.objectContaining({ type: 'gateTaken', lane: 'centre', op: 'add', value, squadCount: 1 + value })])
  })

  it('same_seed_gives_the_same_option_every_run', () => {
    const results = [1, 2, 3].map(() => {
      const run = runWith([gateRow(10, { centre: mystery(plusTenToForty) })], 42)
      runPast(run, 10)
      return run.state.squad.count
    })

    // Seed 42: r = 0.758, option 3.
    expect(results).toEqual([41, 41, 41])
  })

  // Seed 42: left key 1, r = 0.481, option 1; centre key 2, r = 0.758, option 3; right key 3, r = 0.135, option 0.
  it.each([
    ['left', -10 / 3, 20],
    ['centre', 0, 40],
    ['right', 10 / 3, 10],
  ] as const)('mystery_gate_in_the_%s_lane_draws_from_its_own_lane', (lane, x, value) => {
    const run = runWith([gateRow(10, everyLane(mystery(plusTenToForty)))], 42)

    const events = runPast(run, 10, x)

    expect(run.state.gateRows[0].taken).toBe(lane)
    expect(run.state.squad.count).toBe(1 + value)
    expect(gatesTaken(events)).toEqual([expect.objectContaining({ lane, op: 'add', value })])
  })

  it('row_place_counts_every_event_before_it_not_only_gate_rows', () => {
    // Two barrels at the track edge put the row third in events: key 2 × 3 + 1 + 1 = 8, and seed 1 gives r = 0.007, option 0.
    const run = runWith(
      [
        { type: 'barrel', z: 4, x: 5 },
        { type: 'barrel', z: 6, x: 5 },
        gateRow(10, { centre: mystery(plusTenToForty) }),
      ],
      1,
    )

    runPast(run, 10)

    expect(run.state.squad.count).toBe(11)
  })

  it('seed_is_read_as_an_unsigned_32_bit_number', () => {
    // −1 is read as 4294967295: in the left lane of the first event, key 1, r = 0.992, option 3.
    const counts = [-1, 4294967295].map((seed) => {
      const run = runWith([gateRow(10, { left: mystery(plusTenToForty) })], seed)
      runPast(run, 10, -10 / 3)
      return run.state.squad.count
    })

    expect(counts).toEqual([41, 41])
  })

  // Row 0 gives +1 on the left or +2 on the right; row 1, key 1 × 3 + 1 + 1 = 5, is a mystery gate in the centre.
  // Seed 1 gives r = 0.422, option 1; seed 98765 gives r = 0.893, option 3.
  it.each([
    [1, 20],
    [98765, 40],
  ])('mystery_gate_on_seed_%i_applies_plus_%i_whichever_gate_the_squad_took_before', (seed, value) => {
    const events: Level['events'] = [gateRow(10, { left: { op: 'add', value: 1 }, right: { op: 'add', value: 2 } }), gateRow(30, { centre: mystery(plusTenToForty) })]
    const drawn = [-10 / 3, 10 / 3].map((firstLane) => {
      const run = runWith(events, seed)
      runPast(run, 10, firstLane)
      steerTo(run, 0)
      return gatesTaken(runPast(run, 30)).map(({ op, value }) => ({ op, value }))
    })

    expect(drawn).toEqual([[{ op: 'add', value }], [{ op: 'add', value }]])
  })

  it('mystery_gate_draws_the_same_option_whether_or_not_an_earlier_mystery_gate_was_taken', () => {
    // Row 0 has a mystery gate on the left and nothing on the right; row 1 as above, so seed 1 gives option 1, +20.
    const events: Level['events'] = [gateRow(10, { left: mystery(plusTenToForty) }), gateRow(30, { centre: mystery(plusTenToForty) })]
    const drawn = [-10 / 3, 10 / 3].map((firstLane) => {
      const run = runWith(events, 1)
      runPast(run, 10, firstLane)
      steerTo(run, 0)
      return gatesTaken(runPast(run, 30)).map(({ op, value }) => ({ op, value }))
    })

    expect(drawn).toEqual([[{ op: 'add', value: 20 }], [{ op: 'add', value: 20 }]])
  })

  it('mystery_gate_draws_the_same_option_whatever_the_stream_drew_before', () => {
    // Six ×2 rows make a squad of 64 that shoots down a puppy stream; the mystery gate is the seventh event, key 20, and
    // seed 1 gives r = 0.020, option 0, +10.
    const events: Level['events'] = [...doublingRows(6), gateRow(100, { centre: mystery(plusTenToForty) })]
    const drawn = [undefined, { interval: 0.5, enemies: ['puppy' as const] }].map((stream) => {
      const run = runWith(events, 1, stream)
      return gatesTaken(runPast(run, 100))
        .slice(6)
        .map(({ op, value }) => ({ op, value }))
    })

    expect(drawn).toEqual([[{ op: 'add', value: 10 }], [{ op: 'add', value: 10 }]])
  })

  it('taking_a_mystery_gate_does_not_change_where_later_stream_enemies_appear', () => {
    // The same squad count after the gate either way, so only a draw from the run's RNG could move the stream enemies.
    const enemiesAfterGate = (gate: Gate) => {
      const run = runWith([gateRow(5, everyLane(gate))], 1, { interval: 0.5, enemies: ['bulldog'] })
      stepTicks(run, 150)
      return run.state.enemies.map(({ x, z }) => ({ x, z }))
    }

    const afterMystery = enemiesAfterGate(mystery([{ op: 'add', value: 10 }, { op: 'add', value: 10 }]))

    expect(afterMystery.length).toBeGreaterThan(1)
    expect(afterMystery).toEqual(enemiesAfterGate({ op: 'add', value: 10 }))
  })

  it('mystery_gate_that_is_not_taken_applies_nothing', () => {
    const run = runWith([gateRow(10, { left: mystery(plusTenToForty) })], 1)

    const events = runPast(run, 10, 10 / 3)

    expect(run.state.gateRows[0].taken).toBeNull()
    expect(run.state.squad.count).toBe(1)
    expect(gatesTaken(events)).toEqual([])
  })
})

describe('mystery gate options', () => {
  it('weapon_buff_option_applies_as_a_weapon_buff_gate', () => {
    const run = runWith([gateRow(10, everyLane(mystery([{ op: 'damage', value: 1 }, { op: 'damage', value: 1 }])))], 1)

    runPast(run, 10)

    expect(run.state.weapon.damage).toBe(2)
    expect(run.state.squad.count).toBe(1)
  })

  it('multiply_option_doubles_the_squad', () => {
    const run = runWith([...doublingRows(2), gateRow(50, everyLane(mystery([{ op: 'multiply', value: 2 }, { op: 'multiply', value: 2 }])))], 1)

    runPast(run, 50)

    expect(run.state.squad.count).toBe(8)
  })

  it('divide_option_halves_the_squad_rounded_down', () => {
    const run = runWith([...doublingRows(3), { type: 'gates', z: 35, ...everyLane({ op: 'subtract', value: 1 }) }, gateRow(50, everyLane(mystery([{ op: 'divide', value: 2 }, { op: 'divide', value: 2 }])))], 1)

    runPast(run, 50)

    expect(run.state.squad.count).toBe(3)
  })

  it('subtract_option_taking_the_squad_to_0_loses_the_run', () => {
    const run = runWith([gateRow(10, everyLane(mystery([{ op: 'subtract', value: 20 }, { op: 'subtract', value: 20 }])))], 1)

    runPast(run, 10)

    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
  })

  // The documented example: ×2, −20 and +10; r = 0.5 draws option 1, −20. Seed 1 in the centre of the first event has
  // r = 0.698, so option 2, +10, applies.
  it('three_options_are_drawn_by_r_times_3_rounded_down', () => {
    const options: GateFace[] = [
      { op: 'multiply', value: 2 },
      { op: 'subtract', value: 20 },
      { op: 'add', value: 10 },
    ]
    const run = runWith([gateRow(10, { centre: mystery(options) })], 1)

    const events = runPast(run, 10)

    expect(run.state.squad.count).toBe(11)
    expect(gatesTaken(events)).toEqual([expect.objectContaining({ op: 'add', value: 10, squadCount: 11 })])
  })

  // The reveal: the gateTaken event of the tick the gate is taken names the option drawn, so it can be shown at once.
  it('mystery_gate_reports_the_option_drawn_in_the_tick_it_is_taken', () => {
    const run = runWith([gateRow(10, { centre: mystery(plusTenToForty) })], 7)
    let takenEvents: GameEvent[] = []

    while (run.state.gateRows[0].taken === null && run.state.squad.z < 12) takenEvents = copied(run.step(noSteering))

    expect(run.state.gateRows[0].taken).toBe('centre')
    expect(gatesTaken(takenEvents)).toEqual([{ type: 'gateTaken', lane: 'centre', op: 'add', value: 40, squadCount: 41, z: 10, mystery: true }])
  })

  // On level 15 the row at z 10 stands at 19.8, where the reveal is shown.
  it('mystery_gate_reports_the_place_of_its_row', () => {
    const run = createRun({ level: levelOf([gateRow(10, { centre: mystery(plusTenToForty) })], 300, 15), seed: 7 })

    const taken = gatesTaken(runPast(run, 19.8))

    expect(taken.map((event) => event.mystery)).toEqual([true])
    expect(taken[0].z).toBeCloseTo(19.8, 6)
  })

  it('ordinary_and_switching_gates_report_that_they_are_no_mystery_gates', () => {
    const run = runWith([gateRow(10, everyLane({ op: 'add', value: 1 })), gateRow(20, everyLane({ op: 'add', value: 1, switchTo: { op: 'add', value: 2 } }))], 1)

    const events = runPast(run, 20)

    expect(gatesTaken(events).map((event) => event.mystery)).toEqual([false, false])
  })
})
