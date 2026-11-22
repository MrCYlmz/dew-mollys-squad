import type { BossKind, Gate, Level } from '../../src/content/level'
import type { GameEvent, Run, RunState, SteerInput } from '../../src/sim/run'

export const noSteering: SteerInput = { drag: 0, left: false, right: false }

export function levelOf(events: Level['events'], length = 300, level = 1): Level {
  return { id: 'test-level', level, length, events }
}

// Stops early once the run is won or lost, so no test depends on what a finished run does.
export function stepTicks(
  run: Run,
  ticks: number,
  input: SteerInput | ((tick: number) => SteerInput) = noSteering,
): GameEvent[] {
  return stepUntil(run, () => false, ticks, input)
}

export function stepUntil(
  run: Run,
  reached: (state: RunState) => boolean,
  maxTicks: number,
  input: SteerInput | ((tick: number) => SteerInput) = noSteering,
): GameEvent[] {
  const events: GameEvent[] = []
  for (let tick = 0; tick < maxTicks && run.state.status === 'running' && !reached(run.state); tick++) {
    events.push(...copied(run.step(typeof input === 'function' ? input(tick) : input)))
  }
  return events
}

// The sim may reuse its event objects on the next step.
export function copied(events: readonly GameEvent[]): GameEvent[] {
  return events.map((event) => ({ ...event }))
}

// Rows of ×2 gates every 10 units from z = 10: a squad that takes all of them has 2^times cats.
export function doublingRows(times: number): Level['events'] {
  return Array.from({ length: times }, (_, index) => ({
    type: 'gates' as const,
    z: 10 * (index + 1),
    left: { op: 'multiply' as const, value: 2 },
    right: { op: 'multiply' as const, value: 2 },
  }))
}

export function steerTo(run: Run, x: number): void {
  run.step({ drag: x - run.state.squad.steeringPoint, left: false, right: false })
}

// `times` rows of the same gate on both sides, 5 units apart from z = start, so the squad takes the gate `times` times wherever it steers.
export function repeatedRows(gate: Gate, times: number, start = 5): Level['events'] {
  return Array.from({ length: times }, (_, index) => ({ type: 'gates' as const, z: start + 5 * index, left: gate, right: gate }))
}

// A boss level ends with the boss event at z = length, the arena start.
export function bossLevelOf(
  events: Level['events'],
  { boss, expectedSquadAtBoss, length = 300, level = 1 }: { boss: BossKind; expectedSquadAtBoss: number; length?: number; level?: number },
): Level {
  return { id: 'test-boss-level', level, length, expectedSquadAtBoss, events: [...events, { type: 'boss', z: length, boss }] }
}

// Steps until the squad reaches the arena and the boss enters; returns the events of those ticks.
export function stepToArena(run: Run, maxTicks = 6000, input: SteerInput | ((tick: number) => SteerInput) = noSteering): GameEvent[] {
  return stepUntil(run, (state) => state.boss !== null, maxTicks, input)
}
