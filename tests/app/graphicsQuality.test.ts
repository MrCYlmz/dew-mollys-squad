import { describe, expect, it } from 'vitest'
import { chooseGraphicsQuality } from '../../src/app/graphicsQuality'
import { renderConfig } from '../../src/content/renderConfig'

// requirements S-7 (7): until the settings screen, a low fps over the first seconds switches to low graphics,
// and a URL flag forces the choice.
describe('graphics quality choice', () => {
  const lowBelowFps = renderConfig.graphics.autoLowBelowFps

  it('fast_start_keeps_high_graphics', () => {
    expect(chooseGraphicsQuality(null, 60)).toBe('high')
  })

  it('slow_start_switches_to_low_graphics', () => {
    expect(chooseGraphicsQuality(null, lowBelowFps - 1)).toBe('low')
  })

  it('start_at_the_threshold_keeps_high_graphics', () => {
    expect(chooseGraphicsQuality(null, lowBelowFps)).toBe('high')
  })

  it('start_just_below_the_threshold_switches_to_low_graphics', () => {
    expect(chooseGraphicsQuality(null, lowBelowFps - 0.1)).toBe('low')
  })

  it('forced_low_graphics_wins_over_a_fast_start', () => {
    expect(chooseGraphicsQuality('low', 60)).toBe('low')
  })

  it('forced_high_graphics_wins_over_a_slow_start', () => {
    expect(chooseGraphicsQuality('high', 5)).toBe('high')
  })

  // The playbook's budget: 60 fps on a mid-range phone, never below 30.
  it('switch_threshold_lies_within_the_fps_budget', () => {
    expect(lowBelowFps).toBeGreaterThan(30)
    expect(lowBelowFps).toBeLessThanOrEqual(60)
  })
})
