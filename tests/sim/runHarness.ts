import type { Level } from '../../src/content/level'
import type { GameEvent, Run, RunState, SteerInput } from '../../src/sim/run'

export const noSteering: SteerInput = { drag: 0, left: false, right: false }

export function levelOf(events: Level['events'], length = 300): Level {
  return { id: 'test-level', length, events }
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
    events.push(...run.step(typeof input === 'function' ? input(tick) : input))
  }
  return events
}

export function steerTo(run: Run, x: number): void {
  run.step({ drag: x - run.state.squad.steeringPoint, left: false, right: false })
}
