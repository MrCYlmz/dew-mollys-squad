// Every tunable number of the game, named as in docs/domain/.

export const tuning = {
  tickRate: 60,
  track: {
    halfWidth: 5,
  },
  squad: {
    startCount: 1,
    maxCount: 999,
    // The run speed, at speed factor 1.
    forwardSpeed: 12,
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
  // HP and shield at level 1; speed in units/s; contact damage in cats.
  enemies: {
    puppy: { hp: 3, shield: 0, speed: 4, contactDamage: 1 },
    chihuahua: { hp: 1, shield: 0, speed: 9, contactDamage: 1 },
    bulldog: { hp: 40, shield: 0, speed: 2.5, contactDamage: 10 },
    shieldDog: { hp: 15, shield: 30, speed: 3, contactDamage: 3 },
  },
  // Units/s at which every enemy moves across the track toward the squad's centre x.
  enemyChaseSpeed: 6,
  scaling: {
    // Factors per level number above 1.
    enemyHpGrowth: 1.08,
    waveSizeGrowth: 1.05,
    // Added to the speed factor per level number above 1; the speed factor multiplies the run speed and stretches distances along the road.
    speedGrowth: 0.07,
  },
  barrel: {
    hp: 10,
    splashDamage: 30,
    splashRadius: 3,
  },
  wall: {
    depth: 1,
  },
  buffBlock: {
    depth: 1,
  },
  // What each big buff adds or multiplies by; fire rate in per cent of the base fire rate, as on a fire rate gate.
  bigBuff: {
    add: 30,
    multiply: 3,
    fireRate: 60,
    damage: 3,
    multiShot: 2,
    range: 30,
  },
  // Spawn distances are at speed factor 1.
  wave: {
    spawnDistance: 40,
  },
  stream: {
    // How far ahead of the squad's centre a stream enemy appears.
    spawnDistance: 40,
  },
  // Walk speed in units/s. The boss HP time is the seconds the expected squad at boss needs to defeat the boss at the base weapon values.
  bosses: {
    dustbot: { walkSpeed: 1.5, hpTime: 8 },
    megaDustbot: { walkSpeed: 1.5, hpTime: 20 },
  },
  boss: {
    // How far beyond the arena start the boss enters.
    startDistance: 35,
  },
  // Interval in seconds, speed in units/s, cat loss in cats.
  dustBall: {
    interval: 3,
    speed: 10,
    catLoss: 3,
  },
  hitRadius: {
    cat: 0.3,
    yarnBall: 0.12,
    puppy: 0.4,
    chihuahua: 0.3,
    bulldog: 0.6,
    shieldDog: 0.45,
    barrel: 0.45,
    dustbot: 2,
    megaDustbot: 2.5,
    dustBall: 0.5,
  },
  // Seconds into a run of level 1 after which the hand icon that shows how to steer disappears, if the player has not steered.
  handIconTime: 4,
  // Most yarn balls in flight; above it, one yarn ball stands for several cats.
  yarnBallCap: 400,
  // Most enemies alive at once, from the playbook's performance budget.
  limits: {
    enemies: 150,
    // A dust ball reaches the squad in about 3.5 s, so at most two fly at once at one every 3 s.
    dustBalls: 4,
  },
}
