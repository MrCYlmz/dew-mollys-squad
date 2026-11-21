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
  }
}

export function gateColour(gate: SignedGate): GateColour {
  switch (gate.op) {
    case 'add':
    case 'subtract':
      return gate.value > 0 ? 'blue' : 'red'
    case 'multiply':
      return 'blue'
    case 'divide':
      return 'red'
  }
}

export function gateSideAt(x: number): GateSide {
  return x < 0 ? 'left' : 'right'
}
