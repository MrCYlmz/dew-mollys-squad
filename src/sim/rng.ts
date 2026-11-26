// Mulberry32: a small seeded generator, so the same seed replays the same run.
export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = nextState(state)
    return numberOf(state)
  }
}

// The first number a generator started from seed returns, without creating one.
export function firstNumber(seed: number): number {
  return numberOf(nextState(seed >>> 0))
}

function nextState(state: number): number {
  return (state + 0x6d2b79f5) >>> 0
}

function numberOf(state: number): number {
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
