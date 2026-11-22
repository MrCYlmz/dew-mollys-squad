import type { Level } from '../content/level'

// Level order: by level number, then by id.
function comesBefore(first: Level, second: Level): number {
  return first.level - second.level || (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)
}

export function firstLevel(levels: readonly Level[]): Level {
  return levels.reduce((first, level) => (comesBefore(level, first) < 0 ? level : first))
}

// Null after the last level.
export function levelAfter(levels: readonly Level[], level: Level): Level | null {
  let next: Level | null = null
  for (const candidate of levels) {
    if (comesBefore(level, candidate) < 0 && (next === null || comesBefore(candidate, next) < 0)) next = candidate
  }
  return next
}
