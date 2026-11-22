import { describe, expect, it } from 'vitest'
import type { Gate, Level } from '../../src/content/level'
import { applyGate, laneAt } from '../../src/sim/gates'
import { createRun } from '../../src/sim/run'
import { everyLane, levelOf, noSteering, steerTo, stepUntil } from './runHarness'

type GateRowEvent = Extract<Level['events'][number], { type: 'gates' }>
type Lane = 'left' | 'centre' | 'right'

function gateRow(z: number, gates: Partial<Record<Lane, Gate>>): GateRowEvent {
  return { type: 'gates', z, ...gates }
}

const double = { op: 'multiply', value: 2 } as const
const halve = { op: 'divide', value: 2 } as const
const addTen = { op: 'add', value: 10 } as const

function runThroughGates(rows: GateRowEvent[], x = -2.5) {
  const run = createRun({ level: levelOf(rows), seed: 1 })
  if (x !== 0) steerTo(run, x)
  const lastRowZ = rows[rows.length - 1].z
  const events = stepUntil(run, (state) => state.squad.z > lastRowZ + 1, 6000)
  return { run, events }
}

describe('gate math', () => {
  it('add_gate_adds_its_value', () => {
    expect(applyGate(8, { op: 'add', value: 10 })).toBe(18)
  })

  it('subtract_gate_subtracts_its_value', () => {
    expect(applyGate(20, { op: 'subtract', value: -15 })).toBe(5)
  })

  it('subtract_gate_below_zero_leaves_zero', () => {
    expect(applyGate(10, { op: 'subtract', value: -15 })).toBe(0)
  })

  it('multiply_gate_doubles_the_squad', () => {
    expect(applyGate(8, double)).toBe(16)
  })

  it('divide_gate_halves_the_squad_rounded_down', () => {
    expect(applyGate(7, halve)).toBe(3)
  })

  it('divide_gate_leaves_at_least_one_cat', () => {
    expect(applyGate(1, halve)).toBe(1)
  })

  it('multiply_gate_caps_the_squad_at_999', () => {
    expect(applyGate(600, double)).toBe(999)
  })

  it('add_gate_caps_the_squad_at_999', () => {
    expect(applyGate(990, { op: 'add', value: 20 })).toBe(999)
  })

  it('add_gate_reaching_exactly_999_is_not_capped_lower', () => {
    expect(applyGate(989, { op: 'add', value: 10 })).toBe(999)
  })
})

// Steering never lands the squad exactly on a border, so the borders are checked on the lane rule itself.
describe('lanes', () => {
  it.each([
    ['-5', 'left', -5],
    ['-10/3', 'left', -10 / 3],
    ['-2', 'left', -2],
    ['just_below_-5/3', 'left', -5 / 3 - 1e-9],
    ['-5/3', 'centre', -5 / 3],
    ['0', 'centre', 0],
    ['just_below_5/3', 'centre', 5 / 3 - 1e-9],
    ['5/3', 'right', 5 / 3],
    ['10/3', 'right', 10 / 3],
    ['5', 'right', 5],
  ])('squad_centre_at_x_%s_is_in_the_%s_lane', (_label, lane, x) => {
    expect(laneAt(x)).toBe(lane)
  })
})

describe('gates in a run', () => {
  it('squad_of_8_taking_x2_becomes_16', () => {
    const { run } = runThroughGates([10, 20, 30, 40].map((z) => gateRow(z, everyLane(double))))

    expect(run.state.squad.count).toBe(16)
  })

  it('squad_of_1_taking_divide_stays_1', () => {
    const { run } = runThroughGates([gateRow(10, everyLane(halve))])

    expect(run.state.squad.count).toBe(1)
  })

  it('squad_of_8_taking_divide_becomes_4', () => {
    const { run } = runThroughGates([...[10, 20, 30].map((z) => gateRow(z, everyLane(double))), gateRow(40, everyLane(halve))])

    expect(run.state.squad.count).toBe(4)
  })

  it('subtract_gate_taking_the_squad_to_0_loses_the_run', () => {
    const { run } = runThroughGates([gateRow(20, everyLane({ op: 'subtract', value: 30 }))])

    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
  })

  it('squad_count_is_capped_at_999', () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((z) => gateRow(z, everyLane(double)))
    const { run } = runThroughGates(rows)

    expect(run.state.squad.count).toBe(999)
  })

  it('halving_a_capped_squad_starts_from_999', () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((z) => gateRow(z, everyLane(double)))
    const { run } = runThroughGates([...rows, gateRow(110, everyLane(halve))])

    expect(run.state.squad.count).toBe(499)
  })

  // The example from docs/domain/run.md: +10 on the left, ×2 in the centre and an empty right lane.
  const documentedRow = (z: number) => gateRow(z, { left: addTen, centre: double })

  it('squad_at_x_0_takes_the_centre_gate', () => {
    const { run, events } = runThroughGates([documentedRow(10)], 0)

    expect(run.state.squad.x).toBe(0)
    expect(run.state.squad.count).toBe(2)
    expect(run.state.gateRows[0].taken).toBe('centre')
    expect(events.filter((event) => event.type === 'gateTaken')).toEqual([
      { type: 'gateTaken', lane: 'centre', op: 'multiply', value: 2, squadCount: 2 },
    ])
  })

  it('squad_at_x_minus_3_takes_the_left_gate', () => {
    const { run } = runThroughGates([documentedRow(10)], -3)

    expect(run.state.squad.count).toBe(11)
    expect(run.state.gateRows[0].taken).toBe('left')
  })

  it('squad_at_x_3_in_the_empty_lane_takes_no_gate', () => {
    const { run, events } = runThroughGates([documentedRow(10)], 3)

    expect(run.state.squad.count).toBe(1)
    expect(run.state.gateRows[0].taken).toBeNull()
    expect(events.filter((event) => event.type === 'gateTaken')).toEqual([])
    expect(events.filter((event) => event.type === 'catsLost')).toEqual([])
  })

  // +10 on the left, ×2 in the centre, ÷2 on the right: a squad of 1 becomes 11, 2 or stays 1.
  it.each([
    [-2, 'left', 11],
    [1.5, 'centre', 2],
    [2, 'right', 1],
  ])('squad_at_x_%d_takes_the_%s_gate', (x, lane, count) => {
    const { run } = runThroughGates([gateRow(10, { left: addTen, centre: double, right: halve })], x)

    expect(run.state.gateRows[0].taken).toBe(lane)
    expect(run.state.squad.count).toBe(count)
  })

  it('squad_takes_the_gate_of_a_row_with_only_one_gate_in_its_lane', () => {
    // The example from docs/domain/levels.md: a single FIRE RATE +20% gate in the centre lane.
    const { run } = runThroughGates([gateRow(10, { centre: { op: 'fireRate', value: 20 } })], 0)

    expect(run.state.weapon.fireRate).toBeCloseTo(2.4, 9)
    expect(run.state.gateRows[0].taken).toBe('centre')
  })

  it('squad_beside_a_row_with_only_one_gate_takes_nothing', () => {
    const { run, events } = runThroughGates([gateRow(10, { centre: { op: 'fireRate', value: 20 } })], -3)

    expect(run.state.weapon.fireRate).toBe(2)
    expect(run.state.gateRows[0].taken).toBeNull()
    expect(events.filter((event) => event.type === 'gateTaken')).toEqual([])
  })

  it('row_passed_in_an_empty_lane_does_not_stop_the_next_row_being_taken', () => {
    const { run } = runThroughGates([gateRow(10, { left: halve, centre: halve }), gateRow(20, everyLane(addTen))], 3)

    expect(run.state.gateRows.map((row) => row.taken)).toEqual([null, 'right'])
    expect(run.state.squad.count).toBe(11)
  })

  it('taking_one_gate_of_a_row_takes_no_other_gate_of_that_row', () => {
    // Three +10 gates side by side, and a squad close to a lane border: one gate gives +10 once.
    const { run, events } = runThroughGates([gateRow(10, everyLane(addTen))], -1.6)

    expect(run.state.squad.count).toBe(11)
    expect(events.filter((event) => event.type === 'gateTaken')).toHaveLength(1)
  })

  it('squad_takes_the_gate_of_the_lane_it_is_in_when_the_row_reaches_it', () => {
    const run = createRun({ level: levelOf([gateRow(30, { left: halve, centre: halve, right: addTen })]), seed: 1 })
    steerTo(run, -3)
    stepUntil(run, (state) => state.squad.z > 20, 6000)
    steerTo(run, 3)

    stepUntil(run, (state) => state.squad.z > 31, 6000)

    expect(run.state.gateRows[0].taken).toBe('right')
    expect(run.state.squad.count).toBe(11)
  })

  it('gate_that_lowers_the_squad_reports_the_cats_lost', () => {
    const { events } = runThroughGates([...[10, 20, 30].map((z) => gateRow(z, everyLane(double))), gateRow(40, everyLane(halve))])

    expect(events.filter((event) => event.type === 'catsLost')).toEqual([{ type: 'catsLost', count: 4 }])
  })

  it('gate_that_leaves_the_squad_unchanged_reports_no_cats_lost', () => {
    const { events } = runThroughGates([gateRow(10, everyLane(halve))])

    expect(events.filter((event) => event.type === 'catsLost')).toEqual([])
  })

  it('gate_row_is_untaken_before_the_squad_reaches_it', () => {
    const run = createRun({ level: levelOf([gateRow(40, everyLane(double))]), seed: 1 })
    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.z > 30, 6000)

    expect(run.state.gateRows[0].taken).toBeNull()
    expect(run.state.squad.count).toBe(1)
  })

  it('level_gates_start_with_the_signed_gate_value_and_an_empty_lane_holds_no_gate', () => {
    const run = createRun({
      level: levelOf([gateRow(100, { left: addTen, right: { op: 'subtract', value: 15 } })]),
      seed: 1,
    })
    const row = run.state.gateRows[0]

    expect(row.z).toBe(100)
    expect(row.left).toMatchObject({ op: 'add', value: 10, colour: 'blue' })
    expect(row.centre ?? null).toBeNull()
    expect(row.right).toMatchObject({ op: 'subtract', value: -15, colour: 'red' })
  })

  it.each([
    ['add', 'blue', { op: 'add', value: 10 }],
    ['subtract', 'red', { op: 'subtract', value: 15 }],
    ['multiply', 'blue', { op: 'multiply', value: 2 }],
    ['divide', 'red', { op: 'divide', value: 2 }],
    ['fire_rate', 'blue', { op: 'fireRate', value: 20 }],
    ['damage', 'blue', { op: 'damage', value: 1 }],
    ['multi_shot', 'blue', { op: 'multiShot', value: 1 }],
    ['range', 'blue', { op: 'range', value: 10 }],
  ] as const)('%s_gate_is_%s', (_name, colour, gate) => {
    const run = createRun({ level: levelOf([gateRow(100, { centre: gate })]), seed: 1 })

    expect(run.state.gateRows[0].centre).toMatchObject({ colour })
  })
})

describe('tick order', () => {
  // A wave appears 40 units ahead and closes at 8 + 2.5 units/s, so the bulldog meets the squad about
  // 9.5 units before the wave's z. Sweeping the wave's z around gate z + 9.5 makes some runs touch the
  // bulldog in the very tick the squad runs through the gate. Yarn balls fly through the gate, and a
  // bulldog's 40 HP outlasts the shots of 1 cat, so it always reaches the squad.
  it('bulldog_contact_in_the_gate_tick_applies_before_the_gate', () => {
    const gateZ = 60
    let sameTickRuns = 0

    for (let offset = -1.5; offset <= 1.5; offset += 0.05) {
      const run = createRun({
        level: levelOf([
          gateRow(gateZ, everyLane(addTen)),
          { type: 'wave', z: gateZ + 9.5 + offset, enemy: 'bulldog', pattern: 'line', count: 1 },
        ]),
        seed: 1,
      })

      while (run.state.status === 'running' && run.state.squad.z < gateZ + 1) {
        const zBefore = run.state.squad.z
        const events = run.step(noSteering)
        const touched = events.some((event) => event.type === 'catsLost')
        if (touched && zBefore < gateZ && run.state.squad.z >= gateZ) {
          sameTickRuns++
          // Contact first: 1 cat less 10 is 0, which loses the run before the +10 gate could save it.
          expect(run.state.status).toBe('lost')
          expect(run.state.squad.count).toBe(0)
        }
      }
    }

    expect(sameTickRuns).toBeGreaterThan(0)
  })
})
