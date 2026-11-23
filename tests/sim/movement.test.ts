import { describe, expect, it } from 'vitest'
import { createRun } from '../../src/sim/run'
import { doublingRows, levelOf, noSteering, stepTicks, stepUntil } from './runHarness'

const emptyLevel = levelOf([])

describe('squad start', () => {
  it('squad_starts_with_one_cat_at_the_start_line', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    expect(run.state.status).toBe('running')
    expect(run.state.squad.count).toBe(1)
    expect(run.state.squad.z).toBe(0)
    expect(run.state.squad.x).toBe(0)
  })
})

describe('forward movement', () => {
  it('squad_moves_forward_12_units_per_second_on_its_own', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    stepTicks(run, 60)
    expect(run.state.squad.z).toBeCloseTo(12, 6)

    stepTicks(run, 60)
    expect(run.state.squad.z).toBeCloseTo(24, 6)
  })
})

describe('steering point', () => {
  it('relative_drag_moves_the_steering_point_by_the_drag_at_sensitivity_1', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    run.step({ ...noSteering, drag: 1.5 })
    expect(run.state.squad.steeringPoint).toBeCloseTo(1.5, 6)

    run.step({ ...noSteering, drag: -2 })
    expect(run.state.squad.steeringPoint).toBeCloseTo(-0.5, 6)
  })

  it('steering_point_is_clamped_to_the_right_track_edge', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    run.step({ ...noSteering, drag: 20 })

    expect(run.state.squad.steeringPoint).toBe(5)
  })

  it('steering_point_is_clamped_to_the_left_track_edge', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    run.step({ ...noSteering, drag: -20 })

    expect(run.state.squad.steeringPoint).toBe(-5)
  })

  it('drag_back_from_the_edge_starts_from_the_clamped_point', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    run.step({ ...noSteering, drag: 20 })
    run.step({ ...noSteering, drag: -1 })

    expect(run.state.squad.steeringPoint).toBeCloseTo(4, 6)
  })

  it('holding_right_key_moves_the_steering_point_12_units_per_second', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    stepTicks(run, 15, { ...noSteering, right: true })

    expect(run.state.squad.steeringPoint).toBeCloseTo(3, 6)
  })

  it('holding_left_key_moves_the_steering_point_12_units_per_second', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    stepTicks(run, 15, { ...noSteering, left: true })

    expect(run.state.squad.steeringPoint).toBeCloseTo(-3, 6)
  })

  it('holding_a_key_stops_the_steering_point_at_the_track_edge', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    stepTicks(run, 120, { ...noSteering, right: true })

    expect(run.state.squad.steeringPoint).toBe(5)
  })
})

describe('squad follows the steering point', () => {
  it('squad_does_not_jump_to_the_steering_point_in_one_tick', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    run.step({ ...noSteering, drag: 4 })

    expect(run.state.squad.x).toBeGreaterThan(0)
    expect(run.state.squad.x).toBeLessThan(4)
  })

  it('squad_closes_the_gap_to_the_steering_point_in_about_80_ms', () => {
    const run = createRun({ level: emptyLevel, seed: 1 })

    run.step({ ...noSteering, drag: 4 })
    stepTicks(run, 2)
    // 50 ms in: still more than 5% of the gap left
    expect(run.state.squad.x).toBeLessThan(3.8)

    stepTicks(run, 9)
    // 200 ms in: less than 5% of the gap left
    expect(run.state.squad.x).toBeGreaterThan(3.8)
    expect(run.state.squad.x).toBeLessThanOrEqual(4)
  })
})

describe('cats around the steering point', () => {
  it('cats_stay_in_a_tight_cluster_around_the_squad_as_it_moves', () => {
    const run = createRun({ level: levelOf(doublingRows(4)), seed: 1 })
    stepUntil(run, (state) => state.squad.z > 45, 6000)

    stepTicks(run, 120, { ...noSteering, right: true })

    const { cats, squad } = run.state
    expect(cats).toHaveLength(16)
    for (const cat of cats) expect(Math.hypot(cat.x - squad.x, cat.z - squad.z)).toBeLessThan(2.5)
  })
})
