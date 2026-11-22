import { describe, expect, it } from 'vitest'
import { shownHp } from '../../src/sim/hp'

describe('HP shown above an enemy or barrel', () => {
  it('whole_hp_shows_as_it_is', () => {
    expect(shownHp(1)).toBe(1)
    expect(shownHp(3)).toBe(3)
    expect(shownHp(40)).toBe(40)
  })

  it('fractional_hp_shows_rounded_up', () => {
    expect(shownHp(0.24)).toBe(1)
    expect(shownHp(3.24)).toBe(4)
    expect(shownHp(43.2)).toBe(44)
  })

  // Float error from level scaling may leave a whole number a hair above itself.
  it('whole_hp_with_float_error_shows_the_whole_number', () => {
    expect(shownHp(27.000000000000004)).toBe(27)
  })
})
