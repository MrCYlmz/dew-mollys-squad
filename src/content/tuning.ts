// Every tunable number of the game, named as in docs/domain/.

export const tuning = {
  tickRate: 60,
  track: {
    halfWidth: 5,
  },
  squad: {
    startCount: 1,
    maxCount: 999,
    forwardSpeed: 8,
    // Time for the squad to close 95% of the gap to the steering point.
    followTime: 0.08,
    // Cats drawn and firing from distinct places; the squad count shows the rest.
    formationSlots: 60,
    catSpacing: 0.3,
  },
  steering: {
    sensitivity: 1,
    keySpeed: 12,
  },
  cat: {
    fireRate: 2,
    damage: 1,
    range: 30,
    yarnBallSpeed: 30,
    yarnBallsPerShot: 1,
    // Degrees between neighbouring yarn balls of one shot.
    multiShotSpread: 5,
  },
  weaponBuff: {
    // The fire rate cap, as a multiple of the base fire rate.
    maxFireRateFactor: 3,
    maxYarnBallsPerShot: 5,
  },
  gate: {
    // Yarn ball hits that raise an add or subtract gate by 1.
    hitsPerStep: 10,
  },
  // HP and shield at level 1; speed in units/s; contact damage in cats.
  enemies: {
    puppy: { hp: 3, shield: 0, speed: 4, contactDamage: 1 },
    chihuahua: { hp: 1, shield: 0, speed: 9, contactDamage: 1 },
    bulldog: { hp: 40, shield: 0, speed: 2.5, contactDamage: 10 },
    shieldDog: { hp: 15, shield: 30, speed: 3, contactDamage: 3 },
  },
  scaling: {
    // Factors per level number above 1.
    enemyHpGrowth: 1.08,
    waveSizeGrowth: 1.05,
  },
  barrel: {
    hp: 10,
    splashDamage: 30,
    splashRadius: 3,
  },
  wall: {
    depth: 1,
    catLoss: 10,
  },
  wave: {
    spawnDistance: 40,
  },
  hitRadius: {
    cat: 0.3,
    yarnBall: 0.12,
    puppy: 0.4,
    chihuahua: 0.3,
    bulldog: 0.6,
    shieldDog: 0.45,
    barrel: 0.45,
  },
  // Most yarn balls in flight; above it, one yarn ball stands for several cats.
  yarnBallCap: 400,
  // Most enemies alive at once, from the playbook's performance budget.
  limits: {
    enemies: 150,
  },
}
