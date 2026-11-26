import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Gate, GateRowEvent, Level } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import { createRun, type GameEvent, type Run } from '../../src/sim/run'
import { doublingRows, everyLane, levelOf, noSteering, steerTo, stepTicks, stepUntil } from './runHarness'

// requirements S-12 (1–2) and docs/domain/run.md "Switching gates": a switching gate shows its own face on ticks 1–60,
// its second face on ticks 61–120, and so on, counting the run's first tick as tick 1; the face shown in the tick the
// squad reaches the row is the one taken.

// The example from docs/domain/levels.md: +10 in blue that switches to −15 in red.
const plusTenOrMinusFifteen: Gate = { op: 'add', value: 10, switchTo: { op: 'subtract', value: 15 } }
const plusTenOrPlusThirty: Gate = { op: 'add', value: 10, switchTo: { op: 'add', value: 30 } }

const ownFace = { op: 'add', value: 10, colour: 'blue' }
const secondFace = { op: 'subtract', value: -15, colour: 'red' }

function gateRow(z: number, gates: Partial<Record<'left' | 'centre' | 'right', Gate>>): GateRowEvent {
  return { type: 'gates', z, ...gates }
}

function runWith(events: Level['events'], { level = 1, seed = 1, length = 300 } = {}): Run {
  return createRun({ level: levelOf(events, length, level), seed })
}

// The face each tick shows, from tick 1 to lastTick, of the left gate of the first row.
function facesUpTo(run: Run, lastTick: number) {
  const faces: { op: string; value: number; colour: string }[] = []
  for (let tick = 1; tick <= lastTick; tick++) {
    run.step(noSteering)
    const gate = run.state.gateRows[0].left
    faces.push({ op: gate?.op ?? '', value: gate?.value ?? Number.NaN, colour: gate?.colour ?? '' })
  }
  return faces
}

function gatesTaken(events: readonly GameEvent[]) {
  return events.filter((event) => event.type === 'gateTaken')
}

describe('switching gate faces', () => {
  it('switching_gate_shows_its_own_face_before_the_first_tick', () => {
    const run = runWith([gateRow(250, { left: plusTenOrMinusFifteen })])

    expect(run.state.gateRows[0].left).toMatchObject(ownFace)
  })

  it('switching_gate_shows_its_own_face_on_ticks_1_to_60_and_its_second_face_on_ticks_61_to_120', () => {
    const faces = facesUpTo(runWith([gateRow(250, { left: plusTenOrMinusFifteen })]), 120)

    faces.slice(0, 60).forEach((face) => expect(face).toEqual(ownFace))
    faces.slice(60, 120).forEach((face) => expect(face).toEqual(secondFace))
  })

  it('switching_gate_shows_its_own_face_again_on_ticks_121_to_180_and_its_second_face_on_ticks_181_to_240', () => {
    const faces = facesUpTo(runWith([gateRow(250, { left: plusTenOrMinusFifteen })]), 240)

    faces.slice(120, 180).forEach((face) => expect(face).toEqual(ownFace))
    faces.slice(180, 240).forEach((face) => expect(face).toEqual(secondFace))
  })

  it('switching_gate_turns_from_blue_to_red_and_back', () => {
    const colours = facesUpTo(runWith([gateRow(250, { left: plusTenOrMinusFifteen })]), 181).map((face) => face.colour)

    expect([colours[59], colours[60], colours[119], colours[120], colours[179], colours[180]]).toEqual(['blue', 'red', 'red', 'blue', 'blue', 'red'])
  })

  it('switching_gate_of_a_weapon_buff_and_a_divide_shows_each_with_its_own_label_and_colour', () => {
    const run = runWith([gateRow(250, { centre: { op: 'damage', value: 1, switchTo: { op: 'divide', value: 2 } } })])

    stepTicks(run, 60)
    expect(run.state.gateRows[0].centre).toMatchObject({ op: 'damage', value: 1, colour: 'blue' })

    stepTicks(run, 1)
    expect(run.state.gateRows[0].centre).toMatchObject({ op: 'divide', value: 2, colour: 'red' })
  })

  it('all_switching_gates_of_a_level_switch_together', () => {
    const run = runWith([
      gateRow(150, { right: { op: 'multiply', value: 2, switchTo: { op: 'divide', value: 2 } } }),
      gateRow(250, { left: plusTenOrMinusFifteen }),
    ])

    stepTicks(run, 60)
    expect([run.state.gateRows[0].right?.op, run.state.gateRows[1].left?.op]).toEqual(['multiply', 'add'])

    stepTicks(run, 1)
    expect([run.state.gateRows[0].right?.op, run.state.gateRows[1].left?.op]).toEqual(['divide', 'subtract'])
  })

  it('ordinary_gate_next_to_a_switching_gate_keeps_its_face', () => {
    const faces = facesUpTo(runWith([gateRow(250, { left: { op: 'multiply', value: 2 }, right: plusTenOrMinusFifteen })]), 130)

    for (const face of faces) expect(face).toEqual({ op: 'multiply', value: 2, colour: 'blue' })
  })

  it('switching_is_the_same_on_every_seed', () => {
    const faces = (seed: number) => facesUpTo(runWith([gateRow(250, { left: plusTenOrMinusFifteen })], { seed }), 200)

    expect(faces(2)).toEqual(faces(1))
    expect(faces(98765)).toEqual(faces(1))
  })

  // Switching counts ticks, not distance travelled, so a faster level switches on the same ticks.
  it.each([1, 15, 25])('switching_gate_on_level_%i_shows_its_second_face_from_tick_61', (level) => {
    const run = runWith([gateRow(250, { left: plusTenOrMinusFifteen })], { level })

    stepTicks(run, 60)
    expect(run.state.gateRows[0].left).toMatchObject(ownFace)

    stepTicks(run, 1)
    expect(run.state.gateRows[0].left).toMatchObject(secondFace)
  })
})

describe('with another switch time in the tuning config', () => {
  let documentedSwitchTime = 0

  beforeEach(() => {
    documentedSwitchTime = tuning.gate.switchTime
  })

  afterEach(() => {
    tuning.gate.switchTime = documentedSwitchTime
  })

  // The switch time in ticks is the switch time × 60, rounded to the nearest whole tick, halves up, and at least 1 tick.
  it.each([
    ['0.5_s_is_30_ticks', 0.5, 30],
    ['half_a_tick_rounds_up', 0.125, 8],
    ['a_whole_number_of_ticks_stays', 0.1, 6],
    ['less_than_half_a_tick_is_still_1_tick', 0.004, 1],
  ])('switch_time_of_%s', (_case, switchTime, ticks) => {
    tuning.gate.switchTime = switchTime
    const faces = facesUpTo(runWith([gateRow(250, { left: plusTenOrMinusFifteen })]), 3 * ticks).map((face) => face.op)

    expect(faces).toEqual([
      ...Array<string>(ticks).fill('add'),
      ...Array<string>(ticks).fill('subtract'),
      ...Array<string>(ticks).fill('add'),
    ])
  })
})

describe('switching gate taken', () => {
  // On level 1 the squad travels 0.2 units a tick, so it reaches z 11.9 in tick 60 and z 12.1 in tick 61.
  it('squad_reaching_the_row_in_tick_60_takes_the_own_face', () => {
    const run = runWith([gateRow(11.9, everyLane(plusTenOrPlusThirty))])

    const events = stepUntil(run, (state) => state.squad.z > 13, 600)

    expect(run.state.squad.count).toBe(11)
    expect(gatesTaken(events)).toEqual([expect.objectContaining({ type: 'gateTaken', op: 'add', value: 10, squadCount: 11 })])
  })

  it('squad_reaching_the_row_in_tick_61_takes_the_second_face', () => {
    const run = runWith([gateRow(12.1, everyLane(plusTenOrPlusThirty))])

    const events = stepUntil(run, (state) => state.squad.z > 13, 600)

    expect(run.state.squad.count).toBe(31)
    expect(gatesTaken(events)).toEqual([expect.objectContaining({ type: 'gateTaken', op: 'add', value: 30, squadCount: 31 })])
  })

  it('switching_gate_is_taken_once_with_the_face_shown_then', () => {
    const run = runWith([gateRow(11.9, everyLane(plusTenOrPlusThirty))])

    const events = stepUntil(run, (state) => state.squad.z > 40, 600)

    expect(gatesTaken(events)).toHaveLength(1)
    expect(run.state.squad.count).toBe(11)
  })

  // The example from docs/domain/run.md: a row at z 95 reaches the squad about 7.9 s into the run on every level, in its
  // 8th second, so the switching gate shows its second face then. Four ×2 rows first make a squad of 16, which −15 leaves at 1.
  it.each([1, 15, 25])('switching_gate_at_z_95_on_level_%i_applies_its_second_face', (level) => {
    const run = runWith([...doublingRows(4), gateRow(95, { left: plusTenOrMinusFifteen, right: { op: 'multiply', value: 2 } })], { level })
    steerTo(run, -10 / 3)

    const events = stepUntil(run, (state) => state.gateRows[4].taken !== null, 6000)

    expect(run.state.gateRows[4].taken).toBe('left')
    expect(run.state.squad.count).toBe(1)
    expect(gatesTaken(events).at(-1)).toMatchObject({ type: 'gateTaken', lane: 'left', op: 'subtract', squadCount: 1 })
  })

  it('second_face_of_minus_15_taking_the_squad_to_0_loses_the_run', () => {
    const run = runWith([gateRow(12.1, everyLane(plusTenOrMinusFifteen))])

    stepUntil(run, (state) => state.squad.z > 13, 600)

    expect(run.state.squad.count).toBe(0)
    expect(run.state.status).toBe('lost')
  })

  it('weapon_buff_face_taken_applies_as_a_weapon_buff_gate', () => {
    const run = runWith([gateRow(11.9, everyLane({ op: 'damage', value: 1, switchTo: { op: 'divide', value: 2 } }))])

    stepUntil(run, (state) => state.squad.z > 13, 600)

    expect(run.state.weapon.damage).toBe(2)
    expect(run.state.squad.count).toBe(1)
  })

  it('divide_face_taken_halves_the_squad', () => {
    // Four ×2 rows make 16; the row at z 60.1 is reached in tick 301, in the 6th second, which shows the second face.
    const run = runWith([...doublingRows(4), gateRow(60.1, everyLane({ op: 'damage', value: 1, switchTo: { op: 'divide', value: 2 } }))])

    stepUntil(run, (state) => state.squad.z > 61, 600)

    expect(run.state.squad.count).toBe(8)
    expect(run.state.weapon.damage).toBe(1)
  })
})
