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

// Values docs/domain/ names as being in the tuning config.
describe('weapon buffs', () => {
  it('multi_shot_spread_is_5_degrees', () => {
    expect(tuning.cat.multiShotSpread).toBe(5)
  })
})

describe('movement', () => {
  it('run_speed_is_12_units_per_second', () => {
    expect(tuning.squad.forwardSpeed).toBe(12)
  })
})

describe('enemies', () => {
  it('enemy_chase_speed_is_6_units_per_second', () => {
    expect(tuning.enemyChaseSpeed).toBe(6)
  })

  // Both at speed factor 1; the run stretches them by the level's speed factor.
  it('wave_spawn_distance_is_40_units', () => {
    expect(tuning.wave.spawnDistance).toBe(40)
  })

  it('stream_spawn_distance_is_40_units', () => {
    expect(tuning.stream.spawnDistance).toBe(40)
  })

  it('enemy_cap_is_150', () => {
    expect(tuning.limits.enemies).toBe(150)
  })

  // requirements S-12 (6): a defeated dalmatian leaves 3 puppies, 1 unit apart.
  it('dalmatian_split_is_3_puppies_1_unit_apart', () => {
    expect(tuning.dalmatianSplit).toEqual({ puppies: 3, spacing: 1 })
  })
})

// requirements S-12 (1): a switching gate shows each face for 1 s.
describe('gates', () => {
  it('switch_time_is_1_second', () => {
    expect(tuning.gate.switchTime).toBe(1)
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

  // Walls are obstacles now: running into one loses the run instead of costing cats.
  it('wall_has_no_cat_loss', () => {
    expect(tuning.wall).not.toHaveProperty('catLoss')
  })
})

describe('buff blocks', () => {
  it('buff_block_is_1_unit_deep', () => {
    expect(tuning.buffBlock.depth).toBe(1)
  })

  it('unbroken_buff_block_has_no_cat_loss', () => {
    expect(tuning.buffBlock).not.toHaveProperty('catLoss')
  })

  // Fire rate in per cent of the base fire rate, as on a fire rate gate.
  it('big_buff_values_are_plus_30_times_3_fire_rate_60_damage_3_bullet_2_range_30', () => {
    expect(tuning.bigBuff).toEqual({ add: 30, multiply: 3, fireRate: 60, damage: 3, multiShot: 2, range: 30 })
  })
})

describe('level scaling', () => {
  it('enemy_hp_grows_by_1_08_per_level', () => {
    expect(tuning.scaling.enemyHpGrowth).toBe(1.08)
  })

  it('wave_size_grows_by_1_05_per_level', () => {
    expect(tuning.scaling.waveSizeGrowth).toBe(1.05)
  })

  // requirements S-11 (1): the speed factor grows by 0.07 per level number above 1.
  it('speed_grows_by_0_07_per_level', () => {
    expect(tuning.scaling.speedGrowth).toBe(0.07)
  })

  // requirements S-12 (8): the speed factor grows up to level 15 and then stays.
  it('speed_growth_last_level_is_15', () => {
    expect(tuning.scaling.speedGrowthLastLevel).toBe(15)
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

  it('dustbot_hp_time_is_8_seconds', () => {
    expect(tuning.bosses.dustbot.hpTime).toBe(8)
  })

  it('mega_dustbot_hp_time_is_20_seconds', () => {
    expect(tuning.bosses.megaDustbot.hpTime).toBe(20)
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
