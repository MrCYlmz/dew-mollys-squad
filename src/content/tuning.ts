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
  },
  gate: {
    // Yarn ball hits that raise an add or subtract gate by 1.
    hitsPerStep: 10,
  },
  puppy: {
    hp: 3,
    speed: 4,
    contactDamage: 1,
  },
  wave: {
    spawnDistance: 40,
  },
  hitRadius: {
    cat: 0.3,
    puppy: 0.4,
    yarnBall: 0.12,
  },
  // Most yarn balls in flight; above it, one yarn ball stands for several cats.
  yarnBallCap: 400,
  // Most puppies alive at once, from the playbook's performance budget.
  limits: {
    puppies: 150,
  },
}
