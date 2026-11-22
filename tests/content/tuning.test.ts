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

describe('bosses', () => {
  it('dustbot_walks_1_5_units_per_second_with_a_hit_radius_of_2', () => {
    expect(tuning.bosses.dustbot.walkSpeed).toBe(1.5)
    expect(tuning.hitRadius.dustbot).toBe(2)
  })

  it('mega_dustbot_walks_1_5_units_per_second_with_a_hit_radius_of_2_5', () => {
    expect(tuning.bosses.megaDustbot.walkSpeed).toBe(1.5)
    expect(tuning.hitRadius.megaDustbot).toBe(2.5)
  })

  it('boss_hp_time_is_8_seconds', () => {
    expect(tuning.boss.hpTime).toBe(8)
  })

  it('boss_enters_35_units_beyond_the_arena_start', () => {
    expect(tuning.boss.startDistance).toBe(35)
  })
})

describe('dust balls', () => {
  it('dust_ball_is_thrown_every_3_seconds', () => {
    expect(tuning.dustBall.interval).toBe(3)
  })

  it('dust_ball_flies_10_units_per_second', () => {
    expect(tuning.dustBall.speed).toBe(10)
  })

  it('dust_ball_costs_3_cats', () => {
    expect(tuning.dustBall.catLoss).toBe(3)
  })

  it('dust_ball_hit_radius_is_0_5_units', () => {
    expect(tuning.hitRadius.dustBall).toBe(0.5)
  })
})
