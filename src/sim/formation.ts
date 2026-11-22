import { tuning } from '../content/tuning'

// Cats stand in a sunflower spiral around the squad's position: slot 0 in the centre, each next slot a little farther out.
const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const slots = tuning.squad.formationSlots

export const formationOffsetX = new Float64Array(slots)
export const formationOffsetZ = new Float64Array(slots)

for (let slot = 0; slot < slots; slot++) {
  const radius = tuning.squad.catSpacing * Math.sqrt(slot)
  formationOffsetX[slot] = radius * Math.cos(slot * goldenAngle)
  formationOffsetZ[slot] = radius * Math.sin(slot * goldenAngle)
}

export function drawnCats(squadCount: number): number {
  return Math.min(squadCount, slots)
}

// Distance from the squad's position to its outermost cat.
export function formationRadius(squadCount: number): number {
  return squadCount > 1 ? tuning.squad.catSpacing * Math.sqrt(drawnCats(squadCount) - 1) : 0
}
