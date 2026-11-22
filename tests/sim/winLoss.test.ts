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

  it('squad_dropping_to_0_at_a_gate_on_the_finish_line_loses_the_run', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 50, left: { op: 'subtract', value: 30 }, right: { op: 'subtract', value: 30 } }], 50),
      seed: 1,
    })

    stepUntil(run, () => false, 6000)

    expect(run.state.squad.z).toBeGreaterThanOrEqual(50)
    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
  })

  it('lost_run_stays_lost_on_further_steps', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 20, left: { op: 'subtract', value: 30 }, right: { op: 'subtract', value: 30 } }]),
      seed: 1,
    })
    stepUntil(run, () => false, 6000)
    const lostAtZ = run.state.squad.z

    for (let tick = 0; tick < 3000; tick++) run.step({ drag: 0, left: false, right: false })

    expect(run.state.status).toBe('lost')
    expect(run.state.squad.z).toBe(lostAtZ)
  })

  it('won_run_stays_won_on_further_steps', () => {
    const run = createRun({ level: levelOf([], 300), seed: 1 })
    stepUntil(run, () => false, 6000)
    const wonAtZ = run.state.squad.z

    for (let tick = 0; tick < 60; tick++) run.step({ drag: 0, left: false, right: false })

    expect(run.state.status).toBe('won')
    expect(run.state.squad.z).toBe(wonAtZ)
  })

  it('run_lost_at_0_cats_is_out_of_cats', () => {
    const run = createRun({
      level: levelOf([{ type: 'gates', z: 20, left: { op: 'subtract', value: 30 }, right: { op: 'subtract', value: 30 } }]),
      seed: 1,
    })

    stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('outOfCats')
  })

  it('run_lost_to_enemy_contact_is_out_of_cats', () => {
    const run = createRun({ level: levelOf([{ type: 'wave', z: 60, enemy: 'bulldog', pattern: 'column', count: 1, x: 0, spacing: 1 }]), seed: 1 })

    stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('lost')
    expect(run.state.lossCause).toBe('outOfCats')
  })

  it('running_and_won_runs_have_no_loss_cause', () => {
    const run = createRun({ level: levelOf([], 300), seed: 1 })
    expect(run.state.lossCause).toBeNull()

    stepUntil(run, () => false, 6000)

    expect(run.state.status).toBe('won')
    expect(run.state.lossCause).toBeNull()
  })
})
