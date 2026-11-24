import type { Lane } from '../../src/content/level'
import { tuning } from '../../src/content/tuning'
import type { GateRowState, GateState, RunState, SteerInput, WeaponState } from '../../src/sim/run'

// Scripted players for the balance tests of requirements S-6 (7–10).
//
// Both players steer to one lane per gate row, avoid walls and unbroken buff blocks, and otherwise stay where they are.
// The good player takes the best choice of each row, an empty lane included; the bad player takes the worst gate.
// A choice is scored by the squad's firepower after it: squad count × fire rate × damage × yarn balls per shot, so a
// weapon buff is weighed against a gate that changes the squad count. Range adds no firepower and wins only ties.

export type Choice = 'best' | 'worst'

const lanes: readonly Lane[] = ['left', 'centre', 'right']
const laneWidth = (2 * tuning.track.halfWidth) / 3
const laneCentre: Record<Lane, number> = { left: -laneWidth, centre: 0, right: laneWidth }
// How far ahead an obstacle makes the player steer around it: steering settles in about 80 ms, about 1 unit of road.
const obstacleLookahead = 15
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
    case 'add':
      count = Math.min(count + gate.value, tuning.squad.maxCount)
      break
    case 'subtract':
      count = Math.max(count - gate.value, 0)
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
  const score = (lane: Lane) => {
    const firepower = firepowerAfter(row[lane], state.squad.count, state.weapon)
    return choice === 'best' ? firepower : -firepower
  }
  const tieBreak = (lane: Lane) =>
    (choice === 'best' && row[lane]?.op === 'range' ? -10 : 0) + (lane === here ? 0 : 1) + Math.abs(laneCentre[lane] - laneCentre[here]) / 100
  return options.reduce((chosen, lane) => {
    const difference = score(lane) - score(chosen)
    return difference > 0 || (difference === 0 && tieBreak(lane) < tieBreak(chosen)) ? lane : chosen
  })
}

interface ObstacleSpan {
  front: number
  back: number
  blocks: (x: number) => boolean
}

function obstaclesAhead(state: RunState): ObstacleSpan[] {
  const squadZ = state.squad.z
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
  return spans.filter((span) => span.back >= squadZ - 1 && span.front <= squadZ + obstacleLookahead)
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
