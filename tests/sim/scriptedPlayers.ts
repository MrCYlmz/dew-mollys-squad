import type { Gate, GateFace, GateRowEvent, Lane } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import type { GateRowState, RunState, SteerInput, WeaponState } from '../../src/sim/run'

// Scripted players for the balance tests of requirements S-6 (7–10, 9a, 9b), S-11 (10–13) and S-12 (13–15).
//
// Every player steers to one lane per gate row, avoids walls and unbroken buff blocks, and otherwise stays where it is.
// The good player takes the best choice of each row, an empty lane included; the bad player takes the worst gate, and
// the middle player the middle-ranked gate.
// A choice is scored by the squad's firepower after it: squad count × fire rate × damage × yarn balls per shot, so a
// weapon buff is weighed against a gate that changes the squad count. Range adds no firepower and wins only ties.
//
// How each player reads the gates of S-12:
// - A switching gate: the good and the bad player know its rhythm and score the face it will show in the tick its row
//   reaches the squad. The middle player scores the face it sees, and in the last half second before the row arrives it
//   keeps the face it saw half a second before, too late to react to a switch.
// - A mystery gate: nobody sees its options, so every player scores it by the average firepower over its options, as a
//   player who has learned what mystery gates tend to hold.

export type Choice = 'best' | 'middle' | 'worst'

const lanes: readonly Lane[] = ['left', 'centre', 'right']
const laneWidth = (2 * tuning.track.halfWidth) / 3
const laneCentre: Record<Lane, number> = { left: -laneWidth, centre: 0, right: laneWidth }
// How long before an obstacle reaches the squad the player steers around it: steering settles in about 80 ms. On level 1
// that is 15 units of road; on faster levels the road brings the obstacle closer in the same time.
const obstacleLookaheadSeconds = 1.25
// Kept between the squad's centre and a wall's edge when passing it.
const wallClearance = 0.6
// How long before a row arrives the middle player last reads a switching gate.
const middlePlayerReadSeconds = 0.5
// docs/domain/run.md: the switch time in ticks, rounded to the nearest whole tick, halves up, and at least 1 tick.
const switchTicks = Math.max(Math.floor(tuning.gate.switchTime * tuning.tickRate + 0.5), 1)

function laneOf(x: number): Lane {
  if (x < -tuning.track.halfWidth / 3) return 'left'
  return x < tuning.track.halfWidth / 3 ? 'centre' : 'right'
}

function firepowerAfter(face: GateFace | null, count: number, weapon: WeaponState): number {
  let { fireRate, damage, yarnBallsPerShot } = weapon
  const baseFireRate = tuning.cat.fireRate
  switch (face?.op) {
    case undefined:
    case 'range':
      break
    // The level file holds a subtract gate's value unsigned, so −15 is 15.
    case 'add':
      count = Math.min(count + face.value, tuning.squad.maxCount)
      break
    case 'subtract':
      count = Math.max(count - face.value, 0)
      break
    case 'multiply':
      count = Math.min(count * face.value, tuning.squad.maxCount)
      break
    case 'divide':
      count = Math.max(Math.floor(count / face.value), 1)
      break
    case 'fireRate':
      fireRate = Math.min(fireRate + (baseFireRate * face.value) / 100, baseFireRate * tuning.weaponBuff.maxFireRateFactor)
      break
    case 'damage':
      damage += face.value
      break
    case 'multiShot':
      yarnBallsPerShot = Math.min(yarnBallsPerShot + face.value, tuning.weaponBuff.maxYarnBallsPerShot)
      break
  }
  return count * fireRate * damage * yarnBallsPerShot
}

// The face a switching gate shows in a tick, counting the run's first tick as tick 1; before it, its own face.
function faceInTick(gate: GateFace & { switchTo?: GateFace }, tick: number): GateFace {
  if (gate.switchTo === undefined || tick < 1) return gate
  return Math.floor((tick - 1) / switchTicks) % 2 === 0 ? gate : gate.switchTo
}

// The firepower a player expects after taking the gate, or after taking nothing for an empty lane.
function expectedFirepower(gate: Gate | undefined, state: RunState, readTick: number): number {
  if (gate === undefined) return firepowerAfter(null, state.squad.count, state.weapon)
  if (gate.op === 'mystery') {
    const total = gate.options.reduce((sum, option) => sum + firepowerAfter(option, state.squad.count, state.weapon), 0)
    return total / gate.options.length
  }
  return firepowerAfter(faceInTick(gate, readTick), state.squad.count, state.weapon)
}

// The row as written in the level file; the run stretches its z by the speed factor.
function levelRowOf(row: GateRowState, state: RunState): GateRowEvent {
  const levelRow = state.level.events.find((event) => event.type === 'gates' && Math.abs(event.z * state.speedFactor - row.z) < 1e-6)
  if (levelRow?.type !== 'gates') throw new Error(`no gate row at ${row.z} in ${state.level.id}`)
  return levelRow
}

// The tick in which a switching gate of the row is read: the tick the row reaches the squad, or for the middle player the
// tick it sees now, but no later than half a second before the row arrives. `ticksDone` ticks of the run have passed.
function readTickOf(row: GateRowState, state: RunState, choice: Choice, ticksDone: number): number {
  const levelStep = (tuning.squad.forwardSpeed * state.speedFactor) / tuning.tickRate
  const arrivalTick = ticksDone + Math.max(Math.ceil((row.z - state.squad.z) / levelStep - 1e-9), 1)
  return choice === 'middle' ? Math.min(ticksDone, arrivalTick - middlePlayerReadSeconds * tuning.tickRate) : arrivalTick
}

// Ties go to range for the good player, then to the lane the squad is in, then to the nearer lane.
function chosenLane(row: GateRowState, state: RunState, choice: Choice, ticksDone: number): Lane {
  const here = laneOf(state.squad.x)
  const levelRow = levelRowOf(row, state)
  const readTick = readTickOf(row, state, choice, ticksDone)
  const options = lanes.filter((lane) => choice === 'best' || levelRow[lane] !== undefined)
  const firepower = (lane: Lane) => expectedFirepower(levelRow[lane], state, readTick)
  const ranked = options.map(firepower).sort((first, second) => second - first)
  // With two gates the middle-ranked one is the worse; with one gate, that gate.
  const rank = { best: 0, middle: Math.ceil((ranked.length - 1) / 2), worst: ranked.length - 1 }[choice]
  const tieBreak = (lane: Lane) =>
    (choice === 'best' && levelRow[lane]?.op === 'range' ? -10 : 0) + (lane === here ? 0 : 1) + Math.abs(laneCentre[lane] - laneCentre[here]) / 100
  return options
    .filter((lane) => firepower(lane) === ranked[rank])
    .reduce((chosen, lane) => (tieBreak(lane) < tieBreak(chosen) ? lane : chosen))
}

interface ObstacleSpan {
  front: number
  back: number
  blocks: (x: number) => boolean
}

function obstaclesAhead(state: RunState): ObstacleSpan[] {
  const squadZ = state.squad.z
  const levelSpeed = tuning.squad.forwardSpeed * state.speedFactor
  const lookahead = obstacleLookaheadSeconds * levelSpeed
  const spans: ObstacleSpan[] = [
    ...state.walls.map((wall) => ({
      front: wall.z,
      back: wall.z + tuning.wall.depth,
      blocks: (x: number) => x >= wall.x - wall.width / 2 - wallClearance && x <= wall.x + wall.width / 2 + wallClearance,
    })),
    ...state.buffBlocks
      .filter((block) => block.hp > 0)
      .map((block) => ({ front: block.z, back: block.z + tuning.buffBlock.depth, blocks: (x: number) => laneOf(x) === block.lane })),
  ]
  return spans.filter((span) => span.back >= squadZ - 1 && span.front <= squadZ + lookahead)
}

// Where the player wants its squad's centre: the chosen lane of the next gate row, or where it is when no row is left.
function wantedX(state: RunState, choice: Choice, ticksDone: number): number {
  const nextRow = state.gateRows.find((row) => row.z > state.squad.z && row.taken === null)
  return nextRow === undefined ? state.squad.steeringPoint : laneCentre[chosenLane(nextRow, state, choice, ticksDone)]
}

function steeringTarget(state: RunState, choice: Choice, ticksDone: number): number {
  const wanted = wantedX(state, choice, ticksDone)
  const obstacles = obstaclesAhead(state)
  if (obstacles.length === 0) return wanted
  const free = (x: number) => obstacles.every((obstacle) => !obstacle.blocks(x))
  // An obstacle level with the squad must not be crossed on the way to the target.
  const passing = obstacles.filter((obstacle) => obstacle.front <= state.squad.z + 2)
  const reachable = (x: number) => {
    const low = Math.min(x, state.squad.x)
    const high = Math.max(x, state.squad.x)
    return passing.every((obstacle) => {
      for (let probe = low; probe <= high; probe += 0.1) if (obstacle.blocks(probe)) return false
      return true
    })
  }
  const edge = tuning.track.halfWidth - 0.2
  const candidates = [wanted, state.squad.x, ...lanes.map((lane) => laneCentre[lane])]
  for (let x = -edge; x <= edge; x += 0.25) candidates.push(x)
  const usable = candidates.filter((x) => free(x) && reachable(x))
  if (usable.length === 0) return state.squad.steeringPoint
  return usable.reduce((best, x) => {
    const distance = Math.abs(x - wanted) - Math.abs(best - wanted)
    return distance < 0 || (distance === 0 && Math.abs(x - state.squad.x) < Math.abs(best - state.squad.x)) ? x : best
  })
}

// A player for one run, called once before each tick.
export function scriptedPlayer(choice: Choice): (state: RunState) => SteerInput {
  let ticksDone = 0
  return (state) => {
    const input = { drag: steeringTarget(state, choice, ticksDone) - state.squad.steeringPoint, left: false, right: false }
    ticksDone++
    return input
  }
}
