import { describe, expect, it } from 'vitest'
import { createRun, type Run } from '../../src/sim/run'
import { levelOf, noSteering, steerTo } from './runHarness'

type GateSide = 'left' | 'right'

// Steps until the squad has passed the first gate row and returns each side's gate value and colour at every tick.
function watchFirstGateRow(run: Run) {
  const seen: Record<GateSide, { value: number; colour: string }[]> = { left: [], right: [] }
  const record = () => {
    for (const side of ['left', 'right'] as const) {
      const gate = run.state.gateRows[0][side]
      seen[side].push({ value: gate.value, colour: gate.colour })
    }
  }
  record()
  while (run.state.gateRows[0].taken === null && run.state.status === 'running') {
    run.step(noSteering)
    record()
  }
  return seen
}

function distinctInOrder(values: number[]): number[] {
  return values.filter((value, index) => index === 0 || value !== values[index - 1])
}

describe('shooting gates', () => {
  it('each_yarn_ball_hitting_a_subtract_gate_raises_its_value_by_1_through_zero', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 60, left: { op: 'subtract', value: 1 }, right: { op: 'add', value: 5 } }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    const values = distinctInOrder(watchFirstGateRow(run).left.map((seen) => seen.value))

    expect(values.slice(0, 3)).toEqual([-1, 0, 1])
    values.slice(1).forEach((value, index) => expect(value).toBe(values[index] + 1))
  })

  it('each_yarn_ball_hitting_an_add_gate_raises_its_value_by_1', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 60, left: { op: 'add', value: 3 }, right: { op: 'add', value: 3 } }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    const values = distinctInOrder(watchFirstGateRow(run).left.map((seen) => seen.value))

    expect(values.length).toBeGreaterThan(1)
    expect(values[0]).toBe(3)
    values.slice(1).forEach((value, index) => expect(value).toBe(values[index] + 1))
  })

  it('gate_not_in_the_line_of_fire_keeps_its_value', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 60, left: { op: 'subtract', value: 1 }, right: { op: 'add', value: 5 } }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    const right = watchFirstGateRow(run).right

    expect(new Set(right.map((seen) => seen.value))).toEqual(new Set([5]))
  })

  it('add_or_subtract_gate_is_blue_when_positive_and_red_otherwise', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 60, left: { op: 'subtract', value: 2 }, right: { op: 'add', value: 5 } }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    const left = watchFirstGateRow(run).left

    expect(left.some((seen) => seen.value > 0)).toBe(true)
    for (const seen of left) expect(seen.colour).toBe(seen.value > 0 ? 'blue' : 'red')
  })

  it('squad_takes_a_shot_gate_at_its_raised_value', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 60, left: { op: 'subtract', value: 2 }, right: { op: 'add', value: 5 } }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    watchFirstGateRow(run)
    const takenValue = run.state.gateRows[0].left.value

    expect(takenValue).toBeGreaterThan(0)
    expect(run.state.squad.count).toBe(1 + takenValue)
  })

  it('multiply_gate_does_not_change_when_shot', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 60, left: { op: 'multiply', value: 2 }, right: { op: 'divide', value: 2 } }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    const left = watchFirstGateRow(run).left

    for (const seen of left) expect(seen).toEqual({ value: 2, colour: 'blue' })
    expect(run.state.squad.count).toBe(2)
  })

  it('divide_gate_does_not_change_when_shot', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 60, left: { op: 'divide', value: 2 }, right: { op: 'multiply', value: 2 } }]),
      seed: 1,
    })
    steerTo(run, -2.5)

    const left = watchFirstGateRow(run).left

    for (const seen of left) expect(seen).toEqual({ value: 2, colour: 'red' })
  })
})
