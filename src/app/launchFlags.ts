import type { GraphicsQuality } from '../content/renderConfig'

// Developer switches read from the page URL; normal play sets none of them.
export interface LaunchFlags {
  // Shows the performance overlay.
  perf: boolean
  // Plays the stress run instead of the levels.
  stress: boolean
  // Forces the graphics quality instead of the start-up check.
  graphics: GraphicsQuality | null
  // The level number the title's tap starts instead of the first level; null when the flag is missing or not a whole number.
  level: number | null
}

export function readLaunchFlags(search: string): LaunchFlags {
  const parameters = new URLSearchParams(search)
  const graphics = parameters.get('graphics')
  const level = parameters.get('level')
  return {
    perf: parameters.has('perf'),
    stress: parameters.has('stress'),
    graphics: graphics === 'low' || graphics === 'high' ? graphics : null,
    level: level !== null && /^\d+$/.test(level) ? Number(level) : null,
  }
}
