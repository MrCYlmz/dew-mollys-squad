import { describe, expect, it } from 'vitest'
import { readLaunchFlags } from '../../src/app/launchFlags'

// requirements S-7: the performance overlay (5) and the stress run (6) are toggled by URL flags and absent from
// normal play; the graphics quality can be forced with a URL flag (7).
describe('launch flags', () => {
  it('normal_play_shows_no_overlay_runs_no_stress_and_forces_no_graphics', () => {
    expect(readLaunchFlags('')).toEqual({ perf: false, stress: false, graphics: null })
  })

  it('perf_flag_shows_the_performance_overlay', () => {
    expect(readLaunchFlags('?perf').perf).toBe(true)
  })

  it('stress_flag_starts_the_stress_run', () => {
    expect(readLaunchFlags('?stress').stress).toBe(true)
  })

  it('graphics_flag_forces_low_graphics', () => {
    expect(readLaunchFlags('?graphics=low').graphics).toBe('low')
  })

  it('graphics_flag_forces_high_graphics', () => {
    expect(readLaunchFlags('?graphics=high').graphics).toBe('high')
  })

  it('unknown_graphics_value_forces_nothing', () => {
    expect(readLaunchFlags('?graphics=ultra').graphics).toBeNull()
  })

  it('flags_combine', () => {
    expect(readLaunchFlags('?perf&stress&graphics=low')).toEqual({ perf: true, stress: true, graphics: 'low' })
  })

  it('other_query_parameters_leave_normal_play', () => {
    expect(readLaunchFlags('?utm_source=chat')).toEqual({ perf: false, stress: false, graphics: null })
  })
})
