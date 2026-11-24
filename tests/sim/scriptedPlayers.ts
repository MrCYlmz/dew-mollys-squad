import type { Lane } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import type { GateRowState, GateState, RunState, SteerInput, WeaponState } from '../../src/sim/run'

// Scripted players for the balance tests of requirements S-6 (7–10, 9a, 9b) and S-11 (10–13).
//
// Every player steers to one lane per gate row, avoids walls and unbroken buff blocks, and otherwise stays where it is.
// The good player takes the best choice of each row, an empty lane included; the bad player takes the worst gate, and
// the middle player the middle-ranked gate.
// A choice is scored by the squad's firepower after it: squad count × fire rate × damage × yarn balls per shot, so a
// weapon buff is weighed against a gate that changes the squad count. Range adds no firepower and wins only ties.

export type Choice = 'best' | 'middle' | 'worst'

const lanes: readonly Lane[] = ['left', 'centre', 'right']
const laneWidth = (2 * tuning.track.halfWidth) / 3
const laneCentre: Record<Lane, number> = { left: -laneWidth, centre: 0, right: laneWidth }
// How long before an obstacle reaches the squad the player steers around it: steering settles in about 80 ms. On level 1
// that is 15 units of road; on faster levels the road brings the obstacle closer in the same time.
const obstacleLookaheadSeconds = 1.25
// Kept between the squad's centre and a wall's edge when passing it.
const wallClearance = 0.6

function laneOf(x: number): Lane {
  if (x < -tuning.track.halfWidth / 3) return 'left'
  return x < tuning.track.halfWidth / 3 ? 'centre' : 'right'
}

function firepowerAfter(gate: GateState | null, count: number, weapon: WeaponState): number {
  let { fireRate, damage, yarnBallsPerShot } = weapon
  const baseFireRate = tuning.cat.fireRate
  switch (gate?.op) {
    case undefined:
    case 'range':
      break
    // Run state holds a subtract gate's value signed, so −15 is −15.
    case 'add':
    case 'subtract':
      count = Math.min(Math.max(count + gate.value, 0), tuning.squad.maxCount)
      break
    case 'multiply':
      count = Math.min(count * gate.value, tuning.squad.maxCount)
      break
    case 'divide':
      count = Math.max(Math.floor(count / gate.value), 1)
      break
    case 'fireRate':
      fireRate = Math.min(fireRate + (baseFireRate * gate.value) / 100, baseFireRate * tuning.weaponBuff.maxFireRateFactor)
      break
    case 'damage':
      damage += gate.value
      break
    case 'multiShot':
      yarnBallsPerShot = Math.min(yarnBallsPerShot + gate.value, tuning.weaponBuff.maxYarnBallsPerShot)
      break
  }
  return count * fireRate * damage * yarnBallsPerShot
}

// Ties go to range for the good player, then to the lane the squad is in, then to the nearer lane.
function chosenLane(row: GateRowState, state: RunState, choice: Choice): Lane {
  const here = laneOf(state.squad.x)
  const options = lanes.filter((lane) => choice === 'best' || row[lane] !== null)
  const firepower = (lane: Lane) => firepowerAfter(row[lane], state.squad.count, state.weapon)
  const ranked = options.map(firepower).sort((first, second) => second - first)
  // With two gates the middle-ranked one is the worse; with one gate, that gate.
  const rank = { best: 0, middle: Math.ceil((ranked.length - 1) / 2), worst: ranked.length - 1 }[choice]
  const tieBreak = (lane: Lane) =>
    (choice === 'best' && row[lane]?.op === 'range' ? -10 : 0) + (lane === here ? 0 : 1) + Math.abs(laneCentre[lane] - laneCentre[here]) / 100
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
function wantedX(state: RunState, choice: Choice): number {
  const nextRow = state.gateRows.find((row) => row.z > state.squad.z && row.taken === null)
  return nextRow === undefined ? state.squad.steeringPoint : laneCentre[chosenLane(nextRow, state, choice)]
}

function steeringTarget(state: RunState, choice: Choice): number {
  const wanted = wantedX(state, choice)
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

export function scriptedPlayer(choice: Choice): (state: RunState) => SteerInput {
  return (state) => ({ drag: steeringTarget(state, choice) - state.squad.steeringPoint, left: false, right: false })
}
