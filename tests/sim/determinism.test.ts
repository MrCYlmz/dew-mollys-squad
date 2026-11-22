import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Level } from '../../src/content/level'
import { createRun, type RunState, type SteerInput } from '../../src/sim/run'
import { stepUntil } from './runHarness'

const busyLevel: Level = {
  id: 'busy-level',
  length: 300,
  events: [
    { type: 'gates', z: 40, left: { op: 'add', value: 10 }, right: { op: 'multiply', value: 2 } },
    { type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 5 },
    { type: 'gates', z: 100, left: { op: 'subtract', value: 3 }, right: { op: 'divide', value: 2 } },
    { type: 'wave', z: 130, enemy: 'puppy', pattern: 'block', columns: 5, rows: 4, x: 0, spacing: 1.5 },
    { type: 'gates', z: 150, left: { op: 'multiply', value: 2 }, right: { op: 'add', value: 5 } },
    { type: 'wave', z: 180, enemy: 'puppy', pattern: 'column', count: 8, x: -3, spacing: 2 },
    { type: 'gates', z: 200, left: { op: 'add', value: 20 }, right: { op: 'subtract', value: 8 } },
    { type: 'wave', z: 230, enemy: 'puppy', pattern: 'flank', count: 4, spacing: 2 },
    { type: 'gates', z: 250, left: { op: 'multiply', value: 2 }, right: { op: 'multiply', value: 2 } },
  ],
}

function playerInput(tick: number): SteerInput {
  return {
    drag: Math.sin(tick / 25) * 0.2,
    left: tick % 400 > 350,
    right: tick % 300 > 270,
  }
}

function snapshot(state: RunState) {
  return {
    status: state.status,
    squad: { ...state.squad },
    puppies: state.puppies.map((puppy) => ({ ...puppy })),
    yarnBalls: state.yarnBalls.map((yarnBall) => ({ ...yarnBall })),
    gateRows: state.gateRows.map((row) => ({ taken: row.taken, left: { ...row.left }, right: { ...row.right } })),
  }
}

function play(seed: number) {
  const run = createRun({ level: busyLevel, seed })
  const events = stepUntil(run, () => false, 6000, playerInput)
  return { events, state: snapshot(run.state) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('determinism', () => {
  it('same_level_seed_and_input_give_the_same_run', () => {
    const first = play(42)
    const second = play(42)

    expect(first.state.status).not.toBe('running')
    expect(second).toEqual(first)
  })

  it('sim_uses_no_math_random_or_wall_clock', () => {
    const forbidden = () => {
      throw new Error('the sim must not read Math.random or the clock')
    }
    vi.spyOn(Math, 'random').mockImplementation(forbidden)
    vi.spyOn(Date, 'now').mockImplementation(forbidden)
    vi.spyOn(performance, 'now').mockImplementation(forbidden)

    expect(() => play(7)).not.toThrow()
  })
})
