import { describe, expect, it } from 'vitest'
import { tuning } from '../../src/content/tuning'

describe('cat base values at level 1', () => {
  it('cat_fires_2_yarn_balls_per_second', () => {
    expect(tuning.cat.fireRate).toBe(2)
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

describe('gate shooting', () => {
  it('10_hits_raise_a_gate_by_1', () => {
    expect(tuning.gate.hitsPerStep).toBe(10)
  })
})

// Values docs/domain/ names as being in the tuning config.
describe('weapon buffs', () => {
  it('multi_shot_spread_is_5_degrees', () => {
    expect(tuning.cat.multiShotSpread).toBe(5)
  })
})

describe('barrels and walls', () => {
  it('barrel_has_10_hp', () => {
    expect(tuning.barrel.hp).toBe(10)
  })

  it('barrel_splash_deals_30_damage_within_3_units', () => {
    expect(tuning.barrel.splashDamage).toBe(30)
    expect(tuning.barrel.splashRadius).toBe(3)
  })

  it('wall_is_1_unit_deep', () => {
    expect(tuning.wall.depth).toBe(1)
  })

  it('wall_costs_10_cats', () => {
    expect(tuning.wall.catLoss).toBe(10)
  })
})

describe('level scaling', () => {
  it('enemy_hp_grows_by_1_08_per_level', () => {
    expect(tuning.scaling.enemyHpGrowth).toBe(1.08)
  })

  it('wave_size_grows_by_1_05_per_level', () => {
    expect(tuning.scaling.waveSizeGrowth).toBe(1.05)
  })
})
