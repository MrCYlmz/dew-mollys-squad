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
    fireRate: 3,
    damage: 1,
    range: 30,
    yarnBallSpeed: 30,
  },
  gate: {
    valuePerHit: 1,
  },
  puppy: {
    hp: 3,
    speed: 4,
    contactDamage: 1,
    // How far behind the squad a puppy that got past it disappears.
    despawnBehind: 4,
  },
  wave: {
    spawnDistance: 40,
  },
  hitRadius: {
    cat: 0.3,
    puppy: 0.4,
    yarnBall: 0.12,
  },
  // Pool sizes from the playbook's performance budget. A shot fired while every yarn ball is in flight is skipped.
  limits: {
    puppies: 150,
    yarnBalls: 400,
  },
}
