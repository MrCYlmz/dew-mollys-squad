import { describe, expect, it } from 'vitest'
import { createRun } from '../../src/sim/run'
import { levelOf, stepUntil } from './runHarness'

describe('win and loss', () => {
  it('run_is_still_running_just_before_the_finish_line', () => {
    const run = createRun({ level: levelOf([], 300), seed: 1 })

    stepUntil(run, (state) => state.squad.z >= 299.8, 6000)

    expect(run.state.status).toBe('running')
  })

  it('run_is_won_when_the_squad_crosses_the_finish_line', () => {
    const run = createRun({ level: levelOf([], 300), seed: 1 })

    stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('won')
    expect(run.state.squad.z).toBeGreaterThanOrEqual(300)
    expect(run.state.squad.z).toBeLessThan(300.2)
  })

  it('run_is_lost_when_the_squad_count_reaches_0', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 20, left: { op: 'subtract', value: 30 }, right: { op: 'subtract', value: 30 } }]),
      seed: 1,
    })

    stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('lost')
    expect(run.state.squad.count).toBe(0)
    expect(run.state.squad.z).toBeLessThan(300)
  })
})
