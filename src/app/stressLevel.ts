import type { Level, LevelEvent } from '../content/level'

// The heaviest case of the performance budget, played by the real sim: refill gates keep the squad near its cap, so all
// formation slots are drawn and the yarn ball cap is reached, and close-packed waves of high-level puppies keep the enemy
// limit filled. Barrels, walls and buff blocks bring every other kind of object into view. A run lasts about 70 s.
const length = 560
const level = 40
const firstWaveZ = 30
const waveEvery = 3
const puppiesPerLine = 30
const refillEvery = 20
const sideObjectsEvery = 80

function stressEvents(): LevelEvent[] {
  const events: LevelEvent[] = [{ type: 'gates', z: 2, centre: { op: 'add', value: 998 } }]
  for (let z = refillEvery; z < length; z += refillEvery) events.push({ type: 'gates', z, centre: { op: 'add', value: 998 } })
  for (let z = firstWaveZ; z < length; z += waveEvery) events.push({ type: 'wave', z, enemy: 'puppy', pattern: 'line', count: puppiesPerLine })
  // Beside the squad's path, so they cost no cats.
  for (let z = sideObjectsEvery / 2; z < length; z += sideObjectsEvery) {
    events.push({ type: 'barrel', z, x: 4 }, { type: 'wall', z: z + 10, x: -4.5, width: 1 })
    events.push({ type: 'buffBlock', z: z + 20, lane: 'right', hp: 30, buff: 'damage' })
  }
  return events.sort((first, second) => first.z - second.z)
}

export const stressLevel: Level = { id: 'stress', level, length, events: stressEvents() }
