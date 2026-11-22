import type { EnemyKind, GateOp, Level, WaveEvent } from '../content/level'
import { tuning } from '../content/tuning'
import { drawnCats, formationOffsetX, formationOffsetZ, formationRadius } from './formation'
import { applyGate, applyWeaponBuff, gateColour, gateSideAt, type GateColour, type GateSide, type Weapon } from './gates'
import { Pool, Recycler } from './pool'
import { createRng } from './rng'

export interface SteerInput {
  // The pointer's change in x since the last tick, in track units.
  drag: number
  left: boolean
  right: boolean
}

export type RunStatus = 'running' | 'won' | 'lost'

// previousX and previousZ hold the position at the end of the tick before, for drawing between ticks.
export interface SquadState {
  readonly count: number
  readonly x: number
  readonly z: number
  readonly previousX: number
  readonly previousZ: number
  readonly steeringPoint: number
}

// A drawn cat's place on the track at the end of the last tick.
export interface CatState {
  readonly x: number
  readonly z: number
}

export interface EnemyState {
  readonly kind: EnemyKind
  readonly x: number
  readonly z: number
  readonly previousX: number
  readonly previousZ: number
  // The body's HP; a shield dog's shield takes damage first.
  readonly hp: number
  // 0 for enemies without a shield, and once a shield dog's shield is broken.
  readonly shield: number
}

export interface BarrelState {
  readonly x: number
  readonly z: number
  readonly hp: number
}

export interface WallState {
  readonly x: number
  readonly z: number
  readonly width: number
}

export type WeaponState = Readonly<Weapon>

export interface YarnBallState {
  readonly x: number
  readonly z: number
  readonly previousX: number
  readonly previousZ: number
}

export interface GateState {
  readonly op: GateOp
  readonly value: number
  readonly colour: GateColour
}

export interface GateRowState {
  readonly z: number
  readonly left: GateState
  readonly right: GateState
  readonly taken: GateSide | null
}

export interface RunState {
  readonly level: Level
  readonly status: RunStatus
  readonly squad: SquadState
  // The drawn cats, at most formationSlots of them; cats beyond those stand in the same places.
  readonly cats: readonly CatState[]
  readonly weapon: WeaponState
  readonly enemies: readonly EnemyState[]
  readonly barrels: readonly BarrelState[]
  readonly walls: readonly WallState[]
  readonly yarnBalls: readonly YarnBallState[]
  readonly gateRows: readonly GateRowState[]
}

export interface EnemyKilledEvent {
  type: 'enemyKilled'
  enemy: EnemyKind
  cause: 'shot' | 'contact' | 'barrel'
  x: number
  z: number
}

export interface BarrelDestroyedEvent {
  type: 'barrelDestroyed'
  x: number
  z: number
}

export interface CatsLostEvent {
  type: 'catsLost'
  count: number
}

export interface GateTakenEvent {
  type: 'gateTaken'
  side: GateSide
  op: GateOp
  value: number
  squadCount: number
}

export type GameEvent = EnemyKilledEvent | BarrelDestroyedEvent | CatsLostEvent | GateTakenEvent

export interface Run {
  readonly state: RunState
  // The returned list and its events are reused by the next step.
  step(input: SteerInput): readonly GameEvent[]
}

interface Cat {
  x: number
  z: number
}

interface Squad {
  count: number
  x: number
  z: number
  previousX: number
  previousZ: number
  steeringPoint: number
}

interface Enemy {
  kind: EnemyKind
  x: number
  z: number
  previousX: number
  previousZ: number
  hp: number
  shield: number
  // +1 while a flank enemy walks right towards the centre, −1 while it walks left, 0 once it runs straight.
  sideways: number
}

interface Barrel {
  x: number
  z: number
  hp: number
}

interface Wall {
  x: number
  z: number
  width: number
  // Each wall costs cats once.
  touched: boolean
}

interface YarnBall {
  x: number
  z: number
  previousX: number
  previousZ: number
  // The unit direction of flight; yarn balls of a multi-shot fan fly at an angle.
  directionX: number
  directionZ: number
  distance: number
  // How many cats this yarn ball stands for under the yarn ball cap.
  cats: number
}

interface GateCell {
  op: GateOp
  value: number
  colour: GateColour
  // Hits taken towards the next step.
  hits: number
}

interface GateRow {
  z: number
  left: GateCell
  right: GateCell
  taken: GateSide | null
}

type Target = 'none' | 'gate' | 'wall' | 'enemy' | 'barrel'

const dt = 1 / tuning.tickRate
const halfWidth = tuning.track.halfWidth
// Fraction of the gap to the steering point closed per tick, so that 95% is closed after followTime.
const followFactor = 1 - Math.pow(20, -dt / tuning.squad.followTime)
const yarnBallStep = tuning.cat.yarnBallSpeed * dt
const multiShotSpread = (tuning.cat.multiShotSpread * Math.PI) / 180
const barrelShotReach = tuning.hitRadius.yarnBall + tuning.hitRadius.barrel
const barrelContactReach = tuning.hitRadius.cat + tuning.hitRadius.barrel
const catRadius = tuning.hitRadius.cat

function clampToTrack(x: number): number {
  return Math.min(Math.max(x, -halfWidth), halfWidth)
}

function gateCell(op: GateOp, unsignedValue: number): GateCell {
  const value = op === 'subtract' ? -unsignedValue : unsignedValue
  return { op, value, colour: gateColour({ op, value }), hits: 0 }
}

// Share of the path from (x, z) by (dx, dz) at which a point first comes within reach of the centre, or Infinity if it never does.
function sweepCircle(x: number, z: number, dx: number, dz: number, centreX: number, centreZ: number, reach: number): number {
  const fromX = x - centreX
  const fromZ = z - centreZ
  const c = fromX * fromX + fromZ * fromZ - reach * reach
  if (c <= 0) return 0
  const b = 2 * (fromX * dx + fromZ * dz)
  if (b >= 0) return Infinity
  const a = dx * dx + dz * dz
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return Infinity
  const share = (-b - Math.sqrt(discriminant)) / (2 * a)
  return share <= 1 ? share : Infinity
}

// Share of the path from (x, z) by (dx, dz) at which a point first enters the rectangle, or Infinity if it never does.
function sweepRectangle(x: number, z: number, dx: number, dz: number, minX: number, maxX: number, minZ: number, maxZ: number): number {
  let enter = 0
  let exit = 1
  if (dx === 0) {
    if (x < minX || x > maxX) return Infinity
  } else {
    const first = (minX - x) / dx
    const second = (maxX - x) / dx
    enter = Math.max(enter, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
  }
  const first = (minZ - z) / dz
  const second = (maxZ - z) / dz
  enter = Math.max(enter, Math.min(first, second))
  exit = Math.min(exit, Math.max(first, second))
  return enter <= exit ? enter : Infinity
}

class RunSimulation implements Run {
  private readonly squad: Squad
  private readonly catPlaces: Cat[] = []
  // drawnCatLists[n] holds the first n cat places, so a change of the squad count allocates nothing.
  private readonly drawnCatLists: Cat[][] = []
  private readonly weapon: Weapon = {
    fireRate: tuning.cat.fireRate,
    damage: tuning.cat.damage,
    yarnBallsPerShot: tuning.cat.yarnBallsPerShot,
    range: tuning.cat.range,
  }
  private readonly enemies: Pool<Enemy>
  private readonly barrels: Pool<Barrel>
  private readonly walls: Pool<Wall>
  private readonly yarnBalls: Pool<YarnBall>
  private readonly gateRows: GateRow[]
  private readonly waves: WaveEvent[]
  private readonly enemyHpFactor: number
  private readonly waveSizeFactor: number
  private readonly events: GameEvent[] = []
  private readonly enemyKilledEvents = new Recycler<EnemyKilledEvent>(() => ({
    type: 'enemyKilled',
    enemy: 'puppy',
    cause: 'shot',
    x: 0,
    z: 0,
  }))
  private readonly barrelDestroyedEvents = new Recycler<BarrelDestroyedEvent>(() => ({ type: 'barrelDestroyed', x: 0, z: 0 }))
  private readonly catsLostEvents = new Recycler<CatsLostEvent>(() => ({ type: 'catsLost', count: 0 }))
  private readonly gateTakenEvents = new Recycler<GateTakenEvent>(() => ({
    type: 'gateTaken',
    side: 'left',
    op: 'add',
    value: 0,
    squadCount: 0,
  }))
  private readonly random: () => number
  // Time left until each cat's next shot.
  private readonly catCooldowns = new Float64Array(tuning.squad.maxCount)
  private catsWithCooldown = 0
  // Cat shots not yet fired as a yarn ball.
  private pendingCatShots = 0
  private nextWave = 0
  private nextGateRow = 0

  readonly state: RunState & { status: RunStatus; cats: readonly CatState[] }

  constructor(level: Level, seed: number) {
    this.random = createRng(seed)
    this.squad = { count: tuning.squad.startCount, x: 0, z: 0, previousX: 0, previousZ: 0, steeringPoint: 0 }
    for (let slot = 0; slot < tuning.squad.formationSlots; slot++) this.catPlaces.push({ x: 0, z: 0 })
    for (let drawn = 0; drawn <= tuning.squad.formationSlots; drawn++) this.drawnCatLists.push(this.catPlaces.slice(0, drawn))
    this.enemyHpFactor = Math.pow(tuning.scaling.enemyHpGrowth, level.level - 1)
    this.waveSizeFactor = Math.pow(tuning.scaling.waveSizeGrowth, level.level - 1)
    this.enemies = new Pool<Enemy>(
      tuning.limits.enemies,
      () => ({ kind: 'puppy', x: 0, z: 0, previousX: 0, previousZ: 0, hp: 0, shield: 0, sideways: 0 }),
      (enemy) => {
        enemy.kind = 'puppy'
        enemy.x = enemy.z = enemy.previousX = enemy.previousZ = enemy.hp = enemy.shield = enemy.sideways = 0
      },
    )
    this.yarnBalls = new Pool<YarnBall>(
      tuning.yarnBallCap,
      () => ({ x: 0, z: 0, previousX: 0, previousZ: 0, directionX: 0, directionZ: 0, distance: 0, cats: 0 }),
      (yarnBall) => {
        yarnBall.x = yarnBall.z = yarnBall.previousX = yarnBall.previousZ = 0
        yarnBall.directionX = yarnBall.directionZ = yarnBall.distance = yarnBall.cats = 0
      },
    )
    this.barrels = new Pool<Barrel>(
      level.events.filter((event) => event.type === 'barrel').length,
      () => ({ x: 0, z: 0, hp: 0 }),
      (barrel) => {
        barrel.x = barrel.z = barrel.hp = 0
      },
    )
    this.walls = new Pool<Wall>(
      level.events.filter((event) => event.type === 'wall').length,
      () => ({ x: 0, z: 0, width: 0, touched: false }),
      (wall) => {
        wall.x = wall.z = wall.width = 0
        wall.touched = false
      },
    )
    this.gateRows = []
    this.waves = []
    for (const event of level.events) {
      switch (event.type) {
        case 'gates':
          this.gateRows.push({
            z: event.z,
            left: gateCell(event.left.op, event.left.value),
            right: gateCell(event.right.op, event.right.value),
            taken: null,
          })
          break
        case 'wave':
          this.waves.push(event)
          break
        case 'barrel':
          this.placeBarrel(event.x, event.z)
          break
        case 'wall':
          this.placeWall(event.x, event.z, event.width)
          break
      }
    }
    this.state = {
      level,
      status: 'running',
      squad: this.squad,
      cats: this.drawnCatLists[0],
      weapon: this.weapon,
      enemies: this.enemies.active,
      barrels: this.barrels.active,
      walls: this.walls.active,
      yarnBalls: this.yarnBalls.active,
      gateRows: this.gateRows,
    }
    this.placeCats()
  }

  step(input: SteerInput): readonly GameEvent[] {
    this.events.length = 0
    this.enemyKilledEvents.reset()
    this.barrelDestroyedEvents.reset()
    this.catsLostEvents.reset()
    this.gateTakenEvents.reset()
    if (this.state.status !== 'running') return this.events

    this.moveSquad(input)
    this.spawnWaves()
    this.shoot()
    this.moveYarnBalls()
    if (this.resolveCollisions()) return this.events
    if (this.passGates()) return this.events
    this.moveEnemies()
    this.removeObstaclesBehind()
    if (this.squad.z >= this.state.level.length) this.state.status = 'won'
    return this.events
  }

  // The pools hold one place per barrel and wall of the level.
  private placeBarrel(x: number, z: number): void {
    const barrel = this.barrels.acquire()
    if (barrel === undefined) return
    barrel.x = x
    barrel.z = z
    barrel.hp = tuning.barrel.hp
  }

  private placeWall(x: number, z: number, width: number): void {
    const wall = this.walls.acquire()
    if (wall === undefined) return
    wall.x = x
    wall.z = z
    wall.width = width
  }

  private moveSquad(input: SteerInput): void {
    const squad = this.squad
    const keyDirection = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    squad.steeringPoint = clampToTrack(
      squad.steeringPoint + input.drag * tuning.steering.sensitivity + keyDirection * tuning.steering.keySpeed * dt,
    )
    squad.previousX = squad.x
    squad.previousZ = squad.z
    squad.x += (squad.steeringPoint - squad.x) * followFactor
    squad.z += tuning.squad.forwardSpeed * dt
    this.placeCats()
  }

  private placeCats(): void {
    const drawn = drawnCats(this.squad.count)
    for (let slot = 0; slot < drawn; slot++) {
      const cat = this.catPlaces[slot]
      cat.x = this.squad.x + formationOffsetX[slot]
      cat.z = this.squad.z + formationOffsetZ[slot]
    }
    this.state.cats = this.drawnCatLists[drawn]
  }

  private spawnWaves(): void {
    while (this.nextWave < this.waves.length && this.squad.z >= this.waves[this.nextWave].z - tuning.wave.spawnDistance) {
      this.spawnWave(this.waves[this.nextWave])
      this.nextWave++
    }
  }

  // Rounds half up.
  private scaledWaveSize(size: number): number {
    return Math.floor(size * this.waveSizeFactor + 0.5)
  }

  private spawnWave(wave: WaveEvent): void {
    const kind = wave.enemy
    switch (wave.pattern) {
      case 'line': {
        const count = this.scaledWaveSize(wave.count)
        for (let i = 0; i < count; i++) {
          this.spawnEnemy(kind, -halfWidth + (2 * halfWidth * (i + 0.5)) / count, wave.z, 0)
        }
        break
      }
      case 'block': {
        const rows = this.scaledWaveSize(wave.rows)
        const firstX = wave.x - ((wave.columns - 1) * wave.spacing) / 2
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < wave.columns; column++) {
            this.spawnEnemy(kind, firstX + column * wave.spacing, wave.z + row * wave.spacing, 0)
          }
        }
        break
      }
      case 'column': {
        const count = this.scaledWaveSize(wave.count)
        for (let i = 0; i < count; i++) this.spawnEnemy(kind, wave.x, wave.z + i * wave.spacing, 0)
        break
      }
      case 'flank': {
        const count = this.scaledWaveSize(wave.count)
        for (let i = 0; i < count; i++) {
          this.spawnEnemy(kind, -halfWidth, wave.z + i * wave.spacing, 1)
          this.spawnEnemy(kind, halfWidth, wave.z + i * wave.spacing, -1)
        }
        break
      }
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, z: number, sideways: number): void {
    const enemy = this.enemies.acquire()
    if (enemy === undefined) return
    enemy.kind = kind
    enemy.x = enemy.previousX = x
    enemy.z = enemy.previousZ = z
    enemy.hp = tuning.enemies[kind].hp * this.enemyHpFactor
    enemy.shield = tuning.enemies[kind].shield * this.enemyHpFactor
    enemy.sideways = sideways
  }

  private shoot(): void {
    const squad = this.squad
    const weapon = this.weapon
    const fireInterval = 1 / weapon.fireRate
    // Cats that joined since the last tick start at a random point of their fire interval, so the squad does not fire in volleys.
    for (let cat = this.catsWithCooldown; cat < squad.count; cat++) this.catCooldowns[cat] = this.random() * fireInterval
    this.catsWithCooldown = squad.count

    // Yarn balls in flight per cat if every cat fired its own.
    const yarnBallsPerCat = (weapon.fireRate * weapon.yarnBallsPerShot * weapon.range) / tuning.cat.yarnBallSpeed
    const catsPerYarnBall = Math.max(Math.ceil((squad.count * yarnBallsPerCat) / tuning.yarnBallCap), 1)
    const firstAngle = (-(weapon.yarnBallsPerShot - 1) * multiShotSpread) / 2
    const cats = this.state.cats
    for (let cat = 0; cat < squad.count; cat++) {
      this.catCooldowns[cat] -= dt
      if (this.catCooldowns[cat] > 0) continue
      this.catCooldowns[cat] += fireInterval
      this.pendingCatShots++
      if (this.pendingCatShots < catsPerYarnBall) continue
      // With every yarn ball in flight, the shot waits for the next free one instead of being lost;
      // a fan that only partly fits fires the yarn balls there is room for.
      const place = cats[cat % cats.length]
      for (let i = 0; i < weapon.yarnBallsPerShot; i++) {
        const yarnBall = this.yarnBalls.acquire()
        if (yarnBall === undefined) break
        if (i === 0) this.pendingCatShots -= catsPerYarnBall
        const angle = firstAngle + i * multiShotSpread
        yarnBall.x = yarnBall.previousX = place.x
        yarnBall.z = yarnBall.previousZ = place.z
        yarnBall.directionX = Math.sin(angle)
        yarnBall.directionZ = Math.cos(angle)
        yarnBall.distance = 0
        yarnBall.cats = catsPerYarnBall
      }
    }
  }

  private moveYarnBalls(): void {
    for (const yarnBall of this.yarnBalls.active) {
      yarnBall.previousX = yarnBall.x
      yarnBall.previousZ = yarnBall.z
      yarnBall.x += yarnBall.directionX * yarnBallStep
      yarnBall.z += yarnBall.directionZ * yarnBallStep
      yarnBall.distance += yarnBallStep
    }
  }

  // Returns true when the run is lost.
  private resolveCollisions(): boolean {
    const yarnBalls = this.yarnBalls.active
    for (let i = yarnBalls.length - 1; i >= 0; i--) {
      if (this.hitFirstTarget(yarnBalls[i]) || yarnBalls[i].distance >= this.weapon.range) this.yarnBalls.release(i)
    }
    return this.resolveContacts() || this.resolveWalls()
  }

  // A yarn ball sweeps from its previous to its current place; it hits whichever enemy, barrel, wall or gate lies first along that path.
  private hitFirstTarget(yarnBall: YarnBall): boolean {
    const startX = yarnBall.previousX
    const startZ = yarnBall.previousZ
    const dx = yarnBall.x - startX
    const dz = yarnBall.z - startZ
    let hitShare = Infinity
    let target: Target = 'none'
    let hitIndex = -1
    let hitGate: GateCell | null = null

    const row = this.gateRows[this.nextGateRow]
    if (row !== undefined && row.z > startZ && row.z <= yarnBall.z) {
      const share = (row.z - startZ) / dz
      const crossingX = startX + share * dx
      // A gate spans its half of the track; yarn balls beyond the edge pass it.
      if (Math.abs(crossingX) <= halfWidth) {
        hitShare = share
        target = 'gate'
        hitGate = row[gateSideAt(crossingX)]
      }
    }

    const walls = this.walls.active
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i]
      const halfWallWidth = wall.width / 2
      const share = sweepRectangle(startX, startZ, dx, dz, wall.x - halfWallWidth, wall.x + halfWallWidth, wall.z, wall.z + tuning.wall.depth)
      if (share < hitShare) {
        hitShare = share
        target = 'wall'
      }
    }

    const enemies = this.enemies.active
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]
      const share = sweepCircle(startX, startZ, dx, dz, enemy.x, enemy.z, tuning.hitRadius.yarnBall + tuning.hitRadius[enemy.kind])
      if (share < hitShare) {
        hitShare = share
        target = 'enemy'
        hitIndex = i
      }
    }

    const barrels = this.barrels.active
    for (let i = 0; i < barrels.length; i++) {
      const share = sweepCircle(startX, startZ, dx, dz, barrels[i].x, barrels[i].z, barrelShotReach)
      if (share < hitShare) {
        hitShare = share
        target = 'barrel'
        hitIndex = i
      }
    }

    const damage = this.weapon.damage * yarnBall.cats
    switch (target) {
      case 'none':
        return false
      case 'wall':
        return true
      case 'enemy':
        this.damageEnemy(hitIndex, damage, 'shot')
        return true
      case 'barrel': {
        const barrel = barrels[hitIndex]
        barrel.hp -= damage
        if (barrel.hp <= 0) this.destroyBarrel(hitIndex)
        return true
      }
      case 'gate':
        if (hitGate !== null && (hitGate.op === 'add' || hitGate.op === 'subtract')) {
          hitGate.hits += yarnBall.cats
          const steps = Math.floor(hitGate.hits / tuning.gate.hitsPerStep)
          hitGate.hits -= steps * tuning.gate.hitsPerStep
          hitGate.value += steps
          hitGate.colour = gateColour(hitGate)
        }
        return true
    }
  }

  // The shield takes damage first; what it cannot take goes on to the body.
  private damageEnemy(index: number, damage: number, cause: EnemyKilledEvent['cause']): void {
    const enemy = this.enemies.active[index]
    const shieldDamage = Math.min(enemy.shield, damage)
    enemy.shield -= shieldDamage
    enemy.hp -= damage - shieldDamage
    if (enemy.hp > 0) return
    this.pushEnemyKilled(cause, enemy)
    this.enemies.release(index)
  }

  private destroyBarrel(index: number): void {
    const barrel = this.barrels.active[index]
    const reach = tuning.barrel.splashRadius
    const enemies = this.enemies.active
    for (let i = enemies.length - 1; i >= 0; i--) {
      const dx = enemies[i].x - barrel.x
      const dz = enemies[i].z - barrel.z
      if (dx * dx + dz * dz <= reach * reach) this.damageEnemy(i, tuning.barrel.splashDamage, 'barrel')
    }
    const event = this.barrelDestroyedEvents.next()
    event.x = barrel.x
    event.z = barrel.z
    this.events.push(event)
    this.barrels.release(index)
  }

  // Returns true when the run is lost.
  private resolveContacts(): boolean {
    const enemies = this.enemies.active
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i]
      if (!this.touchesSquad(enemy)) continue
      const contactDamage = tuning.enemies[enemy.kind].contactDamage
      this.pushEnemyKilled('contact', enemy)
      this.enemies.release(i)
      if (this.loseCats(contactDamage)) return true
    }
    return false
  }

  private touchesSquad(enemy: Enemy): boolean {
    const contactReach = catRadius + tuning.hitRadius[enemy.kind]
    const squadReach = formationRadius(this.squad.count) + contactReach
    const dx = enemy.x - this.squad.x
    const dz = enemy.z - this.squad.z
    if (dx * dx + dz * dz > squadReach * squadReach) return false
    for (const cat of this.state.cats) {
      const catDx = enemy.x - cat.x
      const catDz = enemy.z - cat.z
      if (catDx * catDx + catDz * catDz <= contactReach * contactReach) return true
    }
    return false
  }

  // Returns true when the run is lost.
  private resolveWalls(): boolean {
    for (const wall of this.walls.active) {
      if (wall.touched || !this.catTouchesWall(wall)) continue
      wall.touched = true
      if (this.loseCats(tuning.wall.catLoss)) return true
    }
    return false
  }

  private catTouchesWall(wall: Wall): boolean {
    const halfWallWidth = wall.width / 2
    for (const cat of this.state.cats) {
      const dx = cat.x - Math.min(Math.max(cat.x, wall.x - halfWallWidth), wall.x + halfWallWidth)
      const dz = cat.z - Math.min(Math.max(cat.z, wall.z), wall.z + tuning.wall.depth)
      if (dx * dx + dz * dz <= catRadius * catRadius) return true
    }
    return false
  }

  // Takes up to count cats from the squad; returns true when that loses the run.
  private loseCats(count: number): boolean {
    const catsLost = Math.min(count, this.squad.count)
    this.squad.count -= catsLost
    this.pushCatsLost(catsLost)
    this.placeCats()
    if (this.squad.count > 0) return false
    this.state.status = 'lost'
    return true
  }

  // Returns true when the run is lost.
  private passGates(): boolean {
    const squad = this.squad
    let row = this.gateRows[this.nextGateRow]
    while (row !== undefined && squad.z >= row.z) {
      const side = gateSideAt(squad.x)
      const gate = row[side]
      const countBefore = squad.count
      squad.count = applyGate(squad.count, gate)
      applyWeaponBuff(this.weapon, gate)
      row.taken = side
      const event = this.gateTakenEvents.next()
      event.side = side
      event.op = gate.op
      event.value = gate.value
      event.squadCount = squad.count
      this.events.push(event)
      if (squad.count < countBefore) this.pushCatsLost(countBefore - squad.count)
      this.placeCats()
      this.nextGateRow++
      if (squad.count === 0) {
        this.state.status = 'lost'
        return true
      }
      row = this.gateRows[this.nextGateRow]
    }
    return false
  }

  private pushEnemyKilled(cause: EnemyKilledEvent['cause'], enemy: Enemy): void {
    const event = this.enemyKilledEvents.next()
    event.enemy = enemy.kind
    event.cause = cause
    event.x = enemy.x
    event.z = enemy.z
    this.events.push(event)
  }

  private pushCatsLost(count: number): void {
    const event = this.catsLostEvents.next()
    event.count = count
    this.events.push(event)
  }

  private moveEnemies(): void {
    const lastCatZ = this.lastCatZ()
    const enemies = this.enemies.active
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i]
      const speed = tuning.enemies[enemy.kind].speed
      enemy.previousX = enemy.x
      enemy.previousZ = enemy.z
      if (enemy.sideways === 0) {
        enemy.z -= speed * dt
      } else {
        const flankStep = (speed * dt) / Math.SQRT2
        enemy.x += enemy.sideways * flankStep
        enemy.z -= flankStep
        if (enemy.x * enemy.sideways >= 0) {
          enemy.x = 0
          enemy.sideways = 0
        }
      }
      // Past the last cat it can touch no cat any more.
      if (enemy.z < lastCatZ - catRadius - tuning.hitRadius[enemy.kind]) this.enemies.release(i)
    }
  }

  private removeObstaclesBehind(): void {
    const lastCatZ = this.lastCatZ()
    const barrels = this.barrels.active
    for (let i = barrels.length - 1; i >= 0; i--) {
      if (barrels[i].z < lastCatZ - barrelContactReach) this.barrels.release(i)
    }
    const walls = this.walls.active
    for (let i = walls.length - 1; i >= 0; i--) {
      if (walls[i].z + tuning.wall.depth < lastCatZ - catRadius) this.walls.release(i)
    }
  }

  private lastCatZ(): number {
    let lastCatZ = Infinity
    for (const cat of this.state.cats) lastCatZ = Math.min(lastCatZ, cat.z)
    return lastCatZ
  }
}

export function createRun({ level, seed }: { level: Level; seed: number }): Run {
  return new RunSimulation(level, seed)
}
