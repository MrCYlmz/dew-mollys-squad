// HP after level scaling is a fraction, and float error can push a whole number just above itself, such as 27.000000000000004.
const wholeNumberTolerance = 1e-9

// The HP number an enemy or barrel shows: its HP rounded up.
export function shownHp(hp: number): number {
  return Math.ceil(hp - wholeNumberTolerance)
}
