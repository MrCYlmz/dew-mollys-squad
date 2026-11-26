import type { GateOp, Lane } from '../content/level'
import { tuning } from '../content/tuning'

// The colour of a face: blue for one that helps the squad, red for one that hurts it.
export type FaceColour = 'blue' | 'red'

// A mystery gate is purple, neither blue nor red.
export type GateColour = FaceColour | 'purple'

export interface SignedGate {
  op: GateOp
  // Signed for add and subtract: a subtract gate of −15 holds −15.
  value: number
}

// The track's three lanes are equally wide, so the borders lie at ± a third of the half width.
export const laneBorder = tuning.track.halfWidth / 3

// A centre exactly on a border is in the lane to its right.
export function laneAt(x: number): Lane {
  if (x < -laneBorder) return 'left'
  return x < laneBorder ? 'centre' : 'right'
}

export function laneCentreX(lane: Lane): number {
  switch (lane) {
    case 'left':
      return -2 * laneBorder
    case 'centre':
      return 0
    case 'right':
      return 2 * laneBorder
  }
}

export function applyGate(squadCount: number, gate: SignedGate): number {
  switch (gate.op) {
    case 'add':
    case 'subtract':
      return Math.min(Math.max(squadCount + gate.value, 0), tuning.squad.maxCount)
    case 'multiply':
      return Math.min(squadCount * gate.value, tuning.squad.maxCount)
    case 'divide':
      return Math.max(Math.floor(squadCount / gate.value), 1)
    case 'fireRate':
    case 'damage':
    case 'multiShot':
    case 'range':
      return squadCount
  }
}

// The values every cat fires with, changed by weapon-buff gates until the end of the run.
export interface Weapon {
  fireRate: number
  damage: number
  yarnBallsPerShot: number
  range: number
}

export function applyWeaponBuff(weapon: Weapon, gate: SignedGate): void {
  switch (gate.op) {
    case 'fireRate': {
      const baseFireRate = tuning.cat.fireRate
      weapon.fireRate = Math.min(
        weapon.fireRate + (baseFireRate * gate.value) / 100,
        baseFireRate * tuning.weaponBuff.maxFireRateFactor,
      )
      break
    }
    case 'damage':
      weapon.damage += gate.value
      break
    case 'multiShot':
      weapon.yarnBallsPerShot = Math.min(weapon.yarnBallsPerShot + gate.value, tuning.weaponBuff.maxYarnBallsPerShot)
      break
    case 'range':
      weapon.range += gate.value
      break
  }
}

export function gateColour(op: GateOp): FaceColour {
  switch (op) {
    case 'subtract':
    case 'divide':
      return 'red'
    case 'add':
    case 'multiply':
    case 'fireRate':
    case 'damage':
    case 'multiShot':
    case 'range':
      return 'blue'
  }
}
