import { describe, expect, it } from 'vitest'
import { tuning } from '../../src/content/tuning'

describe('cat base values at level 1', () => {
  it('cat_fires_3_yarn_balls_per_second', () => {
    expect(tuning.cat.fireRate).toBe(3)
  })

  it('yarn_ball_deals_1_damage', () => {
    expect(tuning.cat.damage).toBe(1)
  })

  it('yarn_ball_range_is_30_units', () => {
    expect(tuning.cat.range).toBe(30)
  })

  it('yarn_ball_flies_30_units_per_second', () => {
    expect(tuning.cat.yarnBallSpeed).toBe(30)
  })
})
