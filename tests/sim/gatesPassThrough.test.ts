import { describe, expect, it } from 'vitest'
import type { Gate, Level } from '../../src/content/level'
import { createRun, type Run } from '../../src/sim/run'
import { doublingRows, everyLane, levelOf, noSteering, stepUntil } from './runHarness'

type GateRowEvent = Extract<Level['events'][number], { type: 'gates' }>

const everyGate: [string, Gate][] = [
  ['add', { op: 'add', value: 10 }],
  ['subtract', { op: 'subtract', value: 15 }],
  ['multiply', { op: 'multiply', value: 2 }],
  ['divide', { op: 'divide', value: 2 }],
  ['fire_rate', { op: 'fireRate', value: 20 }],
  ['damage', { op: 'damage', value: 1 }],
  ['multi_shot', { op: 'multiShot', value: 1 }],
  ['range', { op: 'range', value: 10 }],
]

// Every gate of every row, as the state shows it.
function gatesShown(run: Run) {
  return run.state.gateRows.map((row) => ({ left: { ...row.left }, centre: { ...row.centre }, right: { ...row.right } }))
}

describe('yarn balls and gates', () => {
  it.each(everyGate)('yarn_balls_fly_through_a_%s_gate_and_hit_the_barrel_behind_it', (_name, gate) => {
    const run = createRun({ level: levelOf([{ type: 'gates', z: 20, ...everyLane(gate) }, { type: 'barrel', z: 25, x: 0 }]), seed: 1 })

    stepUntil(run, (state) => state.squad.z >= 19.5, 600)

    expect(run.state.gateRows[0].taken).toBeNull()
    expect(run.state.barrels[0]?.hp ?? 0).toBeLessThan(10)
  })

  it('yarn_balls_fly_through_a_gate_and_hit_the_puppy_behind_it', () => {
    // The puppy closes at 8 + 4 units/s from 36 units out, so it is still beyond the gate at z = 20 when the squad gets there.
    const run = createRun({
      level: levelOf([
        { type: 'gates', z: 20, ...everyLane({ op: 'multiply', value: 2 }) },
        { type: 'wave', z: 36, enemy: 'puppy', pattern: 'line', count: 1 },
      ]),
      seed: 1,
    })
    let puppyHitBeyondTheGate = false

    while (run.state.squad.z < 19.5 && run.state.status === 'running') {
      const events = run.step(noSteering)
      const shotKill = events.some((event) => event.type === 'enemyKilled' && event.cause === 'shot' && event.z > 20)
      const hurt = run.state.enemies.some((puppy) => puppy.z > 20 && puppy.hp < 3)
      if (shotKill || hurt) puppyHitBeyondTheGate = true
    }

    expect(puppyHitBeyondTheGate).toBe(true)
  })

  it('yarn_balls_reach_past_a_gate_row_while_the_squad_is_behind_it', () => {
    const run = createRun({ level: levelOf([...doublingRows(4), { type: 'gates', z: 60, ...everyLane({ op: 'add', value: 1 }) }]), seed: 1 })
    let pastTheRow = 0

    while (Math.max(...run.state.cats.map((cat) => cat.z)) < 59.5 && run.state.status === 'running') {
      run.step(noSteering)
      pastTheRow += run.state.yarnBalls.filter((yarnBall) => yarnBall.z > 60 && Math.abs(yarnBall.x) <= 5).length
    }

    expect(run.state.squad.count).toBe(16)
    expect(pastTheRow).toBeGreaterThan(0)
  })

  // 1 cat, 128 cats, and 512 cats whose yarn balls each stand for 3 cats under the yarn ball cap.
  it.each([
    [0, 1],
    [7, 128],
    [9, 512],
  ])('gate_values_and_colours_never_change_while_%i_doublings_fire_at_them', (doublings, squadCount) => {
    const rows: GateRowEvent[] = [
      { type: 'gates', z: 120, left: { op: 'subtract', value: 2 }, centre: { op: 'add', value: 3 }, right: { op: 'add', value: 5 } },
      { type: 'gates', z: 125, left: { op: 'multiply', value: 2 }, centre: { op: 'divide', value: 2 }, right: { op: 'damage', value: 1 } },
      { type: 'gates', z: 130, left: { op: 'fireRate', value: 20 }, centre: { op: 'range', value: 10 }, right: { op: 'multiShot', value: 1 } },
    ]
    const run = createRun({ level: levelOf([...doublingRows(doublings), ...rows]), seed: 1 })
    const atStart = gatesShown(run)

    stepUntil(run, (state) => state.squad.z > 100, 6000)
    expect(run.state.squad.count).toBe(squadCount)

    while (run.state.squad.z <= 131 && run.state.status === 'running') {
      run.step(noSteering)
      expect(gatesShown(run)).toEqual(atStart)
    }

    // The centre lane: + 3, then ÷ 2 rounded down, then RANGE +10.
    expect(run.state.squad.count).toBe(Math.floor((squadCount + 3) / 2))
    expect(run.state.weapon.range).toBe(40)
  })

  it('squad_of_8_takes_a_minus_2_gate_it_fired_at_as_minus_2', () => {
    const run = createRun({
      level: levelOf([...doublingRows(3), { type: 'gates', z: 60, ...everyLane({ op: 'subtract', value: 2 }) }]),
      seed: 1,
    })

    const events = stepUntil(run, (state) => state.squad.z > 61, 6000)

    expect(run.state.squad.count).toBe(6)
    expect(events.filter((event) => event.type === 'gateTaken').at(-1)).toMatchObject({ op: 'subtract', value: -2, squadCount: 6 })
  })
})
