import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type Run } from '../../src/sim/run'
import { doublingRows, levelOf, noSteering, steerTo } from './runHarness'

type GateSide = 'left' | 'right'
type GateRowEvent = Extract<Level['events'][number], { type: 'gates' }>

// Steps until the squad has passed the last gate row and returns each side's gate value and colour at every tick.
function watchLastGateRow(run: Run) {
  const row = () => run.state.gateRows[run.state.gateRows.length - 1]
  const seen: Record<GateSide, { value: number; colour: string }[]> = { left: [], right: [] }
  const record = () => {
    for (const side of ['left', 'right'] as const) {
      const gate = row()[side]
      seen[side].push({ value: gate.value, colour: gate.colour })
    }
  }
  record()
  while (row().taken === null && run.state.status === 'running') {
    run.step(noSteering)
    record()
  }
  return seen
}

function distinctInOrder(values: number[]): number[] {
  return values.filter((value, index) => index === 0 || value !== values[index - 1])
}

// A squad of 2^doublings cats left of centre, then the gate row under test at z = 60.
function squadFacingGateRow(doublings: number, left: GateRowEvent['left'], right: GateRowEvent['right']) {
  const run = createRun({ level: levelOf([...doublingRows(doublings), { type: 'gates', z: 60, left, right }]), seed: 1 })
  steerTo(run, -2.5)
  return run
}

// Yarn balls fired within range of a gate all reach it before the squad does: at 8 units/s the
// squad fires for 30 / 8 = 3.75 s at it, so a squad of n cats lands about n × 2 × 3.75 hits.
describe('shooting gates', () => {
  it('fewer_than_10_hits_leave_a_gate_unchanged', () => {
    // 1 cat lands about 7.5 hits
    const run = squadFacingGateRow(0, { op: 'subtract', value: 15 }, { op: 'subtract', value: 15 })

    const left = watchLastGateRow(run).left

    for (const seen of left) expect(seen).toEqual({ value: -15, colour: 'red' })
  })

  it('10_to_19_hits_raise_a_gate_by_1', () => {
    // 2 cats land about 15 hits
    const run = squadFacingGateRow(1, { op: 'subtract', value: 15 }, { op: 'subtract', value: 15 })

    const values = distinctInOrder(watchLastGateRow(run).left.map((seen) => seen.value))

    expect(values).toEqual([-15, -14])
  })

  it('every_10_yarn_ball_hits_raise_a_gate_by_1', () => {
    // 128 cats land about 960 hits, so about 96 steps
    const run = createRun({
      level: levelOf([...doublingRows(7), { type: 'gates', z: 120, left: { op: 'add', value: 1 }, right: { op: 'add', value: 1 } }]),
      seed: 1,
    })

    const seen = watchLastGateRow(run)
    const steps = seen.left[seen.left.length - 1].value - 1 + (seen.right[seen.right.length - 1].value - 1)

    expect(steps).toBeGreaterThanOrEqual(96 * 0.85)
    expect(steps).toBeLessThanOrEqual(96 * 1.15)
  })

  it('subtract_gate_shot_rises_by_1_at_a_time_through_zero', () => {
    // 8 cats land about 60 hits, so about 6 steps
    const run = squadFacingGateRow(3, { op: 'subtract', value: 2 }, { op: 'add', value: 5 })

    const values = distinctInOrder(watchLastGateRow(run).left.map((seen) => seen.value))

    expect(values.slice(0, 4)).toEqual([-2, -1, 0, 1])
    values.slice(1).forEach((value, index) => expect(value).toBe(values[index] + 1))
  })

  it('add_gate_shot_rises_by_1_at_a_time', () => {
    const run = squadFacingGateRow(3, { op: 'add', value: 3 }, { op: 'add', value: 3 })

    const values = distinctInOrder(watchLastGateRow(run).left.map((seen) => seen.value))

    expect(values.length).toBeGreaterThan(1)
    expect(values[0]).toBe(3)
    values.slice(1).forEach((value, index) => expect(value).toBe(values[index] + 1))
  })

  it('gate_not_in_the_line_of_fire_keeps_its_value', () => {
    const run = squadFacingGateRow(3, { op: 'subtract', value: 2 }, { op: 'add', value: 5 })

    const right = watchLastGateRow(run).right

    expect(new Set(right.map((seen) => seen.value))).toEqual(new Set([5]))
  })

  it('add_or_subtract_gate_is_blue_when_positive_and_red_otherwise', () => {
    const run = squadFacingGateRow(3, { op: 'subtract', value: 2 }, { op: 'add', value: 5 })

    const left = watchLastGateRow(run).left

    expect(left.some((seen) => seen.value > 0)).toBe(true)
    for (const seen of left) expect(seen.colour).toBe(seen.value > 0 ? 'blue' : 'red')
  })

  it('squad_takes_a_shot_gate_at_its_raised_value', () => {
    const run = squadFacingGateRow(3, { op: 'subtract', value: 2 }, { op: 'add', value: 5 })

    watchLastGateRow(run)
    const takenValue = run.state.gateRows[3].left.value

    expect(takenValue).toBeGreaterThan(0)
    expect(run.state.squad.count).toBe(8 + takenValue)
  })

  it('multiply_gate_does_not_change_when_shot', () => {
    const run = squadFacingGateRow(3, { op: 'multiply', value: 2 }, { op: 'divide', value: 2 })

    const left = watchLastGateRow(run).left

    for (const seen of left) expect(seen).toEqual({ value: 2, colour: 'blue' })
    expect(run.state.squad.count).toBe(16)
  })

  it('divide_gate_does_not_change_when_shot', () => {
    const run = squadFacingGateRow(3, { op: 'divide', value: 2 }, { op: 'multiply', value: 2 })

    const left = watchLastGateRow(run).left

    for (const seen of left) expect(seen).toEqual({ value: 2, colour: 'red' })
    expect(run.state.squad.count).toBe(4)
  })
})
