import { describe, expect, it } from 'vitest'
import { readLaunchFlags } from '../../src/app/launchFlags'

// requirements S-7: the performance overlay (5) and the stress run (6) are toggled by URL flags and absent from
// normal play; the graphics quality can be forced with a URL flag (7).
describe('launch flags', () => {
  it('normal_play_shows_no_overlay_runs_no_stress_forces_no_graphics_and_picks_no_level', () => {
    expect(readLaunchFlags('')).toEqual({ perf: false, stress: false, graphics: null, level: null })
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
    expect(readLaunchFlags('?perf&stress&graphics=low&level=12')).toEqual({ perf: true, stress: true, graphics: 'low', level: 12 })
  })

  it('other_query_parameters_leave_normal_play', () => {
    expect(readLaunchFlags('?utm_source=chat')).toEqual({ perf: false, stress: false, graphics: null, level: null })
  })
})

// requirements S-11 (16–17): ?level=N picks the level the title's tap starts; a value that is not a whole number picks
// none. Whether a level with that number exists is up to the game, which knows the levels.
describe('level flag', () => {
  it.each([
    ['?level=12', 12],
    ['?level=1', 1],
    ['?level=15', 15],
    ['?level=16', 16],
    ['?level=25', 25],
  ])('level_flag_%s_picks_level_%i', (search, level) => {
    expect(readLaunchFlags(search).level).toBe(level)
  })

  it.each(['?level=12.5', '?level=abc', '?level=12abc', '?level=', '?level'])('level_flag_%s_is_not_a_whole_number_and_picks_no_level', (search) => {
    expect(readLaunchFlags(search).level).toBeNull()
  })

  it('no_level_flag_picks_no_level', () => {
    expect(readLaunchFlags('?perf').level).toBeNull()
  })
})
