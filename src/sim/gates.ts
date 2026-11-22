import type { GateOp } from '../content/level'
import { tuning } from '../content/tuning'

export type GateSide = 'left' | 'right'
export type GateColour = 'blue' | 'red'

export interface SignedGate {
  op: GateOp
  // Signed for add and subtract: a subtract gate of −15 holds −15, and +1 once shot past 0.
  value: number
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

export function gateColour(gate: SignedGate): GateColour {
  switch (gate.op) {
    case 'add':
    case 'subtract':
      return gate.value > 0 ? 'blue' : 'red'
    case 'divide':
      return 'red'
    case 'multiply':
    case 'fireRate':
    case 'damage':
    case 'multiShot':
    case 'range':
      return 'blue'
  }
}

export function gateSideAt(x: number): GateSide {
  return x < 0 ? 'left' : 'right'
}
