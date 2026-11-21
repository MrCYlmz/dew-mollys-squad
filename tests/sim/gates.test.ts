import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { applyGate } from '../../src/sim/gates'
import { createRun } from '../../src/sim/run'
import { levelOf, steerTo, stepUntil } from './runHarness'

type GateRowEvent = Extract<Level['events'][number], { type: 'gates' }>

function gateRow(z: number, left: GateRowEvent['left'], right: GateRowEvent['right'] = left): GateRowEvent {
  return { type: 'gates', z, left, right }
}

const double = { op: 'multiply', value: 2 } as const
const halve = { op: 'divide', value: 2 } as const

function runThroughGates(rows: GateRowEvent[], x = -2.5) {
  const run = createRun({ level: levelOf(rows), seed: 1 })
  steerTo(run, x)
  const lastRowZ = rows[rows.length - 1].z
  stepUntil(run, (state) => state.squad.z > lastRowZ + 1, 6000)
  return run
}

describe('gate math', () => {
  it('add_gate_adds_its_value', () => {
    expect(applyGate(8, { op: 'add', value: 10 })).toBe(18)
  })

  it('subtract_gate_subtracts_its_value', () => {
    expect(applyGate(20, { op: 'subtract', value: -15 })).toBe(5)
  })

  it('subtract_gate_shot_positive_adds_its_value', () => {
    expect(applyGate(4, { op: 'subtract', value: 1 })).toBe(5)
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

describe('gates in a run', () => {
  it('squad_of_8_taking_x2_becomes_16', () => {
    const run = runThroughGates([gateRow(10, double), gateRow(20, double), gateRow(30, double), gateRow(40, double)])

    expect(run.state.squad.count).toBe(16)
  })

  it('squad_of_1_taking_divide_stays_1', () => {
    const run = runThroughGates([gateRow(10, halve)])

    expect(run.state.squad.count).toBe(1)
  })

  it('squad_of_8_taking_divide_becomes_4', () => {
    const run = runThroughGates([gateRow(10, double), gateRow(20, double), gateRow(30, double), gateRow(40, halve)])

    expect(run.state.squad.count).toBe(4)
  })

  it('subtract_gate_taking_the_squad_to_0_loses_the_run', () => {
    const run = runThroughGates([gateRow(20, { op: 'subtract', value: 30 })])

    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
  })

  it('squad_count_is_capped_at_999', () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((z) => gateRow(z, double))
    const run = runThroughGates(rows)

    expect(run.state.squad.count).toBe(999)
  })

  it('halving_a_capped_squad_starts_from_999', () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((z) => gateRow(z, double))
    const run = runThroughGates([...rows, gateRow(110, halve)])

    expect(run.state.squad.count).toBe(499)
  })

  it('squad_left_of_centre_takes_the_left_gate', () => {
    const run = runThroughGates([gateRow(10, double, halve), gateRow(20, double, halve)], -2.5)

    expect(run.state.squad.count).toBe(4)
    expect(run.state.gateRows.map((row) => row.taken)).toEqual(['left', 'left'])
  })

  it('squad_right_of_centre_takes_the_right_gate', () => {
    const run = runThroughGates([gateRow(10, halve, double), gateRow(20, halve, double)], 2.5)

    expect(run.state.squad.count).toBe(4)
    expect(run.state.gateRows.map((row) => row.taken)).toEqual(['right', 'right'])
  })

  it('gate_row_is_untaken_before_the_squad_reaches_it', () => {
    const run = createRun({ level: levelOf([gateRow(40, double)]), seed: 1 })
    steerTo(run, -2.5)
    stepUntil(run, (state) => state.squad.z > 30, 6000)

    expect(run.state.gateRows[0].taken).toBeNull()
    expect(run.state.squad.count).toBe(1)
  })

  it('level_gates_start_with_the_signed_gate_value', () => {
    const run = createRun({
      level: levelOf([gateRow(100, { op: 'add', value: 10 }, { op: 'subtract', value: 15 })]),
      seed: 1,
    })

    expect(run.state.gateRows[0].z).toBe(100)
    expect(run.state.gateRows[0].left).toMatchObject({ op: 'add', value: 10, colour: 'blue' })
    expect(run.state.gateRows[0].right).toMatchObject({ op: 'subtract', value: -15, colour: 'red' })
  })
})
