import type { BigBuff, BossKind, EnemyKind, Gate, GateOp, Lane, Level, Stream, WaveEvent } from '../content/level'
import { tuning } from '../content/tuning'
import { drawnCats, formationOffsetX, formationOffsetZ, formationRadius } from './formation'
import {
  applyGate,
  applyWeaponBuff,
  gateColour,
  laneAt,
  laneBorder,
  laneCentreX,
  type GateColour,
  type SignedGate,
  type Weapon,
} from './gates'
import { Pool, Recycler } from './pool'
import { createRng } from './rng'

export interface SteerInput {
  // The pointer's change in x since the last tick, in track units.
  drag: number
  left: boolean
  right: boolean
}

export type RunStatus = 'running' | 'won' | 'lost'

export type LossCause = 'outOfCats' | 'caughtByBoss' | 'ranIntoWall' | 'ranIntoBlock'

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

export interface BuffBlockState {
  readonly lane: Lane
  // The front edge, facing the squad.
  readonly z: number
  readonly hp: number
  readonly buff: BigBuff
}

// A big buff uncovered by a broken buff block, standing where the block's front edge was.
export interface BigBuffState {
  readonly lane: Lane
  readonly z: number
  readonly buff: BigBuff
}

export interface BossState {
  readonly kind: BossKind
  readonly x: number
  readonly z: number
  readonly previousX: number
  readonly previousZ: number
  readonly hp: number
  readonly fullHp: number
}

export interface DustBallState {
  readonly x: number
  readonly z: number
  readonly previousX: number
  readonly previousZ: number
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

// An empty lane holds null.
export interface GateRowState {
  readonly z: number
  readonly left: GateState | null
  readonly centre: GateState | null
  readonly right: GateState | null
  // Stays null when the squad passes the row in an empty lane.
  readonly taken: Lane | null
}

export interface RunState {
  readonly level: Level
  readonly status: RunStatus
  // Null while the run goes on and after a win.
  readonly lossCause: LossCause | null
  readonly squad: SquadState
  // The drawn cats, at most formationSlots of them; cats beyond those stand in the same places.
  readonly cats: readonly CatState[]
  readonly weapon: WeaponState
  readonly enemies: readonly EnemyState[]
  readonly barrels: readonly BarrelState[]
  readonly walls: readonly WallState[]
  readonly buffBlocks: readonly BuffBlockState[]
  readonly bigBuffs: readonly BigBuffState[]
  readonly yarnBalls: readonly YarnBallState[]
  readonly gateRows: readonly GateRowState[]
  // Null until the squad reaches the boss arena, and in a level without a boss.
  readonly boss: BossState | null
  readonly dustBalls: readonly DustBallState[]
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
  lane: Lane
  op: GateOp
  value: number
  squadCount: number
}

export interface BuffBlockBrokenEvent {
  type: 'buffBlockBroken'
  lane: Lane
  buff: BigBuff
}

export interface BigBuffCollectedEvent {
  type: 'bigBuffCollected'
  buff: BigBuff
  squadCount: number
}

export interface BossEnteredEvent {
  type: 'bossEntered'
  boss: BossKind
}

// One per yarn ball that hits the boss.
export interface BossHitEvent {
  type: 'bossHit'
}

export interface BossDefeatedEvent {
  type: 'bossDefeated'
  boss: BossKind
}

export interface DustBallThrownEvent {
  type: 'dustBallThrown'
}

// The cats it costs come as a catsLost event in the same tick.
export interface DustBallHitEvent {
  type: 'dustBallHit'
}

export type GameEvent =
  | EnemyKilledEvent
  | BarrelDestroyedEvent
  | CatsLostEvent
  | GateTakenEvent
  | BuffBlockBrokenEvent
  | BigBuffCollectedEvent
  | BossEnteredEvent
  | BossHitEvent
  | BossDefeatedEvent
  | DustBallThrownEvent
  | DustBallHitEvent

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
}

interface Boss {
  kind: BossKind
  x: number
  z: number
  previousX: number
  previousZ: number
  hp: number
  fullHp: number
  // Ticks since the boss entered, counting its entry tick as 0, for a boss that throws dust balls.
  ticksInArena: number
}

interface BuffBlock {
  lane: Lane
  z: number
  hp: number
  buff: BigBuff
}

interface BigBuffPickup {
  lane: Lane
  z: number
  buff: BigBuff
  // Set once it has reached the squad's centre without being collected, so it is lost.
  passed: boolean
}

interface DustBall {
  x: number
  z: number
  previousX: number
  previousZ: number
  // The unit direction of flight, fixed when thrown.
  directionX: number
  directionZ: number
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
}

interface GateRow {
  z: number
  left: GateCell | null
  centre: GateCell | null
  right: GateCell | null
  taken: Lane | null
}

type Target = 'none' | 'wall' | 'buffBlock' | 'enemy' | 'barrel'

const dt = 1 / tuning.tickRate
const halfWidth = tuning.track.halfWidth
// Fraction of the gap to the steering point closed per tick, so that 95% is closed after followTime.
const followFactor = 1 - Math.pow(20, -dt / tuning.squad.followTime)
const yarnBallStep = tuning.cat.yarnBallSpeed * dt
const multiShotSpread = (tuning.cat.multiShotSpread * Math.PI) / 180
const barrelShotReach = tuning.hitRadius.yarnBall + tuning.hitRadius.barrel
const barrelContactReach = tuning.hitRadius.cat + tuning.hitRadius.barrel
const catRadius = tuning.hitRadius.cat
const dustBallStep = tuning.dustBall.speed * dt
const enemyChaseStep = tuning.enemyChaseSpeed * dt
const dustBallContactReach = catRadius + tuning.hitRadius.dustBall
const bossHitEvent: BossHitEvent = { type: 'bossHit' }
const dustBallThrownEvent: DustBallThrownEvent = { type: 'dustBallThrown' }
const dustBallHitEvent: DustBallHitEvent = { type: 'dustBallHit' }
// The gate a collected big buff acts as, reused for every collection.
const bigBuffGate: SignedGate = { op: 'add', value: 0 }

// Boss HP is the expected squad at boss's damage per second at the base weapon values, times the boss HP time.
function bossHp(expectedSquadAtBoss: number): number {
  return expectedSquadAtBoss * tuning.cat.fireRate * tuning.cat.damage * tuning.cat.yarnBallsPerShot * tuning.boss.hpTime
}

function clampToTrack(x: number): number {
  return Math.min(Math.max(x, -halfWidth), halfWidth)
}

function gateCell(gate: Gate | undefined): GateCell | null {
  if (gate === undefined) return null
  return { op: gate.op, value: gate.op === 'subtract' ? -gate.value : gate.value, colour: gateColour(gate.op) }
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
  private readonly buffBlocks: Pool<BuffBlock>
  private readonly bigBuffs: Pool<BigBuffPickup>
  private readonly yarnBalls: Pool<YarnBall>
  private readonly dustBalls: Pool<DustBall>
  // Created with the run and shown in the state once it enters the arena.
  private readonly boss: Boss | null = null
  private readonly gateRows: GateRow[]
  private readonly waves: WaveEvent[]
  private readonly stream: Stream
  private readonly streamTicks: number
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
    lane: 'left',
    op: 'add',
    value: 0,
    squadCount: 0,
  }))
  private readonly buffBlockBrokenEvents = new Recycler<BuffBlockBrokenEvent>(() => ({ type: 'buffBlockBroken', lane: 'left', buff: 'add' }))
  private readonly bigBuffCollectedEvents = new Recycler<BigBuffCollectedEvent>(() => ({
    type: 'bigBuffCollected',
    buff: 'add',
    squadCount: 0,
  }))
  // A run has at most one boss, so it enters and is defeated at most once.
  private readonly bossEnteredEvent: BossEnteredEvent = { type: 'bossEntered', boss: 'dustbot' }
  private readonly bossDefeatedEvent: BossDefeatedEvent = { type: 'bossDefeated', boss: 'dustbot' }
  private readonly random: () => number
  // Time left until each cat's next shot.
  private readonly catCooldowns = new Float64Array(tuning.squad.maxCount)
  private catsWithCooldown = 0
  // Cat shots not yet fired as a yarn ball.
  private pendingCatShots = 0
  private nextWave = 0
  private nextGateRow = 0
  // Ticks stepped while running, counting the first as 1.
  private tick = 0
  private nextStreamEnemy = 0

  readonly state: RunState & { status: RunStatus; lossCause: LossCause | null; cats: readonly CatState[]; boss: Boss | null }

  constructor(level: Level, seed: number) {
    this.random = createRng(seed)
    this.squad = { count: tuning.squad.startCount, x: 0, z: 0, previousX: 0, previousZ: 0, steeringPoint: 0 }
    for (let slot = 0; slot < tuning.squad.formationSlots; slot++) this.catPlaces.push({ x: 0, z: 0 })
    for (let drawn = 0; drawn <= tuning.squad.formationSlots; drawn++) this.drawnCatLists.push(this.catPlaces.slice(0, drawn))
    this.enemyHpFactor = Math.pow(tuning.scaling.enemyHpGrowth, level.level - 1)
    this.waveSizeFactor = Math.pow(tuning.scaling.waveSizeGrowth, level.level - 1)
    this.enemies = new Pool<Enemy>(
      tuning.limits.enemies,
      () => ({ kind: 'puppy', x: 0, z: 0, previousX: 0, previousZ: 0, hp: 0, shield: 0 }),
      (enemy) => {
        enemy.kind = 'puppy'
        enemy.x = enemy.z = enemy.previousX = enemy.previousZ = enemy.hp = enemy.shield = 0
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
      () => ({ x: 0, z: 0, width: 0 }),
      (wall) => {
        wall.x = wall.z = wall.width = 0
      },
    )
    const buffBlockCount = level.events.filter((event) => event.type === 'buffBlock').length
    this.buffBlocks = new Pool<BuffBlock>(
      buffBlockCount,
      () => ({ lane: 'left', z: 0, hp: 0, buff: 'add' }),
      (buffBlock) => {
        buffBlock.lane = 'left'
        buffBlock.z = buffBlock.hp = 0
        buffBlock.buff = 'add'
      },
    )
    this.bigBuffs = new Pool<BigBuffPickup>(
      buffBlockCount,
      () => ({ lane: 'left', z: 0, buff: 'add', passed: false }),
      (bigBuff) => {
        bigBuff.lane = 'left'
        bigBuff.z = 0
        bigBuff.buff = 'add'
        bigBuff.passed = false
      },
    )
    this.dustBalls = new Pool<DustBall>(
      tuning.limits.dustBalls,
      () => ({ x: 0, z: 0, previousX: 0, previousZ: 0, directionX: 0, directionZ: 0 }),
      (dustBall) => {
        dustBall.x = dustBall.z = dustBall.previousX = dustBall.previousZ = dustBall.directionX = dustBall.directionZ = 0
      },
    )
    this.gateRows = []
    this.waves = []
    this.stream = level.stream
    // Whole ticks, rounded half up, and at least 1.
    this.streamTicks = Math.max(Math.floor(level.stream.interval * tuning.tickRate + 0.5), 1)
    for (const event of level.events) {
      switch (event.type) {
        case 'gates':
          this.gateRows.push({ z: event.z, left: gateCell(event.left), centre: gateCell(event.centre), right: gateCell(event.right), taken: null })
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
        case 'buffBlock':
          this.placeBuffBlock(event.lane, event.z, event.hp, event.buff)
          break
        case 'boss': {
          if (level.expectedSquadAtBoss === undefined) throw new Error(`Level ${level.id} has a boss but no expectedSquadAtBoss`)
          const hp = bossHp(level.expectedSquadAtBoss)
          this.boss = { kind: event.boss, x: 0, z: 0, previousX: 0, previousZ: 0, hp, fullHp: hp, ticksInArena: 0 }
          break
        }
      }
    }
    this.state = {
      level,
      status: 'running',
      lossCause: null,
      squad: this.squad,
      cats: this.drawnCatLists[0],
      weapon: this.weapon,
      enemies: this.enemies.active,
      barrels: this.barrels.active,
      walls: this.walls.active,
      buffBlocks: this.buffBlocks.active,
      bigBuffs: this.bigBuffs.active,
      yarnBalls: this.yarnBalls.active,
      gateRows: this.gateRows,
      boss: null,
      dustBalls: this.dustBalls.active,
    }
    this.placeCats()
  }

  step(input: SteerInput): readonly GameEvent[] {
    this.events.length = 0
    this.enemyKilledEvents.reset()
    this.barrelDestroyedEvents.reset()
    this.catsLostEvents.reset()
    this.gateTakenEvents.reset()
    this.buffBlockBrokenEvents.reset()
    this.bigBuffCollectedEvents.reset()
    if (this.state.status !== 'running') return this.events

    this.tick++
    this.moveSquad(input)
    this.spawnWaves()
    this.spawnStreamEnemy()
    this.enterBoss()
    this.shoot()
    this.moveYarnBalls()
    this.moveDustBalls()
    if (this.resolveCollisions()) return this.events
    if (this.passGates()) return this.events
    this.reachBigBuffs()
    this.moveEnemies()
    this.moveBoss()
    this.removeObjectsBehind()
    if (this.boss === null && this.squad.z >= this.state.level.length) this.state.status = 'won'
    return this.events
  }

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

  private placeBuffBlock(lane: Lane, z: number, hp: number, buff: BigBuff): void {
    const buffBlock = this.buffBlocks.acquire()
    if (buffBlock === undefined) return
    buffBlock.lane = lane
    buffBlock.z = z
    buffBlock.hp = hp * this.enemyHpFactor
    buffBlock.buff = buff
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
    // In a boss level the squad stops at the arena start.
    if (this.boss !== null) squad.z = Math.min(squad.z, this.state.level.length)
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

  private spawnStreamEnemy(): void {
    if (this.tick % this.streamTicks !== 0 || this.squad.z >= this.state.level.length) return
    const kind = this.stream.enemies[this.nextStreamEnemy]
    this.nextStreamEnemy = (this.nextStreamEnemy + 1) % this.stream.enemies.length
    this.spawnEnemy(kind, -halfWidth + this.random() * 2 * halfWidth, this.squad.z + tuning.stream.spawnDistance)
  }

  private enterBoss(): void {
    const boss = this.boss
    if (boss === null || this.state.boss !== null || this.squad.z < this.state.level.length) return
    boss.x = boss.previousX = 0
    boss.z = boss.previousZ = this.state.level.length + tuning.boss.startDistance
    boss.ticksInArena = 0
    this.state.boss = boss
    this.bossEnteredEvent.boss = boss.kind
    this.events.push(this.bossEnteredEvent)
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
          this.spawnEnemy(kind, -halfWidth + (2 * halfWidth * (i + 0.5)) / count, wave.z)
        }
        break
      }
      case 'block': {
        const rows = this.scaledWaveSize(wave.rows)
        const firstX = wave.x - ((wave.columns - 1) * wave.spacing) / 2
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < wave.columns; column++) {
            this.spawnEnemy(kind, firstX + column * wave.spacing, wave.z + row * wave.spacing)
          }
        }
        break
      }
      case 'column': {
        const count = this.scaledWaveSize(wave.count)
        for (let i = 0; i < count; i++) this.spawnEnemy(kind, wave.x, wave.z + i * wave.spacing)
        break
      }
      case 'flank': {
        const count = this.scaledWaveSize(wave.count)
        for (let i = 0; i < count; i++) {
          this.spawnEnemy(kind, -halfWidth, wave.z + i * wave.spacing)
          this.spawnEnemy(kind, halfWidth, wave.z + i * wave.spacing)
        }
        break
      }
    }
  }

  // An enemy that would spawn while the enemy cap is reached is dropped.
  private spawnEnemy(kind: EnemyKind, x: number, z: number): void {
    const enemy = this.enemies.acquire()
    if (enemy === undefined) return
    enemy.kind = kind
    enemy.x = enemy.previousX = x
    enemy.z = enemy.previousZ = z
    enemy.hp = tuning.enemies[kind].hp * this.enemyHpFactor
    enemy.shield = tuning.enemies[kind].shield * this.enemyHpFactor
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

  private moveDustBalls(): void {
    for (const dustBall of this.dustBalls.active) {
      dustBall.previousX = dustBall.x
      dustBall.previousZ = dustBall.z
      dustBall.x += dustBall.directionX * dustBallStep
      dustBall.z += dustBall.directionZ * dustBallStep
    }
  }

  // Returns true when the run is won or lost. Yarn ball hits come first, so a yarn ball that defeats the boss wins over any contact in the same tick.
  private resolveCollisions(): boolean {
    const yarnBalls = this.yarnBalls.active
    for (let i = yarnBalls.length - 1; i >= 0; i--) {
      if (this.hitFirstTarget(yarnBalls[i]) || yarnBalls[i].distance >= this.weapon.range) this.yarnBalls.release(i)
      if (this.state.status === 'won') return true
    }
    return this.resolveContacts() || this.resolveWalls() || this.resolveBuffBlocks() || this.resolveDustBalls() || this.resolveBossContact()
  }

  // A yarn ball sweeps from its previous to its current place; it hits whichever enemy, barrel, wall, buff block or boss lies first
  // along that path, and flies through gates.
  private hitFirstTarget(yarnBall: YarnBall): boolean {
    const startX = yarnBall.previousX
    const startZ = yarnBall.previousZ
    const dx = yarnBall.x - startX
    const dz = yarnBall.z - startZ
    let hitShare = Infinity
    let target: Target = 'none'
    let hitIndex = -1

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

    const buffBlocks = this.buffBlocks.active
    for (let i = 0; i < buffBlocks.length; i++) {
      const buffBlock = buffBlocks[i]
      const centreX = laneCentreX(buffBlock.lane)
      const share = sweepRectangle(
        startX,
        startZ,
        dx,
        dz,
        centreX - laneBorder,
        centreX + laneBorder,
        buffBlock.z,
        buffBlock.z + tuning.buffBlock.depth,
      )
      if (share < hitShare) {
        hitShare = share
        target = 'buffBlock'
        hitIndex = i
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
    const boss = this.state.boss
    if (boss !== null && sweepCircle(startX, startZ, dx, dz, boss.x, boss.z, tuning.hitRadius.yarnBall + tuning.hitRadius[boss.kind]) < hitShare) {
      this.damageBoss(boss, damage)
      return true
    }

    switch (target) {
      case 'none':
        return false
      case 'wall':
        return true
      case 'buffBlock':
        this.damageBuffBlock(hitIndex, damage)
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
    }
  }

  // A broken block uncovers its big buff where its front edge was.
  private damageBuffBlock(index: number, damage: number): void {
    const buffBlock = this.buffBlocks.active[index]
    buffBlock.hp -= damage
    if (buffBlock.hp > 0) return
    const bigBuff = this.bigBuffs.acquire()
    if (bigBuff !== undefined) {
      bigBuff.lane = buffBlock.lane
      bigBuff.z = buffBlock.z
      bigBuff.buff = buffBlock.buff
      // Uncovered only after it reached the squad's centre in an earlier tick, so it is lost.
      bigBuff.passed = this.squad.previousZ >= buffBlock.z
    }
    const event = this.buffBlockBrokenEvents.next()
    event.lane = buffBlock.lane
    event.buff = buffBlock.buff
    this.events.push(event)
    this.buffBlocks.release(index)
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

  private damageBoss(boss: Boss, damage: number): void {
    boss.hp -= damage
    this.events.push(bossHitEvent)
    if (boss.hp > 0) return
    this.bossDefeatedEvent.boss = boss.kind
    this.events.push(this.bossDefeatedEvent)
    this.state.status = 'won'
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
    return this.withinReachOfACat(enemy.x, enemy.z, catRadius + tuning.hitRadius[enemy.kind])
  }

  private withinReachOfACat(x: number, z: number, contactReach: number): boolean {
    const squadReach = formationRadius(this.squad.count) + contactReach
    const dx = x - this.squad.x
    const dz = z - this.squad.z
    if (dx * dx + dz * dz > squadReach * squadReach) return false
    for (const cat of this.state.cats) {
      const catDx = x - cat.x
      const catDz = z - cat.z
      if (catDx * catDx + catDz * catDz <= contactReach * contactReach) return true
    }
    return false
  }

  // Returns true when the run is lost.
  private resolveDustBalls(): boolean {
    const dustBalls = this.dustBalls.active
    for (let i = dustBalls.length - 1; i >= 0; i--) {
      if (!this.withinReachOfACat(dustBalls[i].x, dustBalls[i].z, dustBallContactReach)) continue
      this.dustBalls.release(i)
      this.events.push(dustBallHitEvent)
      if (this.loseCats(tuning.dustBall.catLoss)) return true
    }
    return false
  }

  // Returns true when the run is lost.
  private resolveBossContact(): boolean {
    const boss = this.state.boss
    if (boss === null || !this.withinReachOfACat(boss.x, boss.z, catRadius + tuning.hitRadius[boss.kind])) return false
    this.lose('caughtByBoss')
    return true
  }

  // Returns true when the run is lost. Only the squad's centre running into a wall loses it; cats the wall clips are safe.
  private resolveWalls(): boolean {
    const squad = this.squad
    for (const wall of this.walls.active) {
      const halfWallWidth = wall.width / 2
      if (Math.abs(squad.x - wall.x) > halfWallWidth || squad.z < wall.z || squad.z > wall.z + tuning.wall.depth) continue
      this.lose('ranIntoWall')
      return true
    }
    return false
  }

  // Returns true when the run is lost.
  private resolveBuffBlocks(): boolean {
    const squad = this.squad
    for (const buffBlock of this.buffBlocks.active) {
      if (laneAt(squad.x) !== buffBlock.lane || squad.z < buffBlock.z || squad.z > buffBlock.z + tuning.buffBlock.depth) continue
      this.lose('ranIntoBlock')
      return true
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
    this.lose('outOfCats')
    return true
  }

  private lose(cause: LossCause): void {
    this.state.status = 'lost'
    this.state.lossCause = cause
  }

  // Returns true when the run is lost.
  private passGates(): boolean {
    const squad = this.squad
    for (let row = this.gateRows[this.nextGateRow]; row !== undefined && squad.z >= row.z; row = this.gateRows[this.nextGateRow]) {
      this.nextGateRow++
      const lane = laneAt(squad.x)
      const gate = row[lane]
      if (gate === null) continue
      row.taken = lane
      const countBefore = squad.count
      squad.count = applyGate(squad.count, gate)
      applyWeaponBuff(this.weapon, gate)
      const event = this.gateTakenEvents.next()
      event.lane = lane
      event.op = gate.op
      event.value = gate.value
      event.squadCount = squad.count
      this.events.push(event)
      if (squad.count < countBefore) this.pushCatsLost(countBefore - squad.count)
      this.placeCats()
      if (squad.count === 0) {
        this.lose('outOfCats')
        return true
      }
    }
    return false
  }

  // A big buff reaching the squad's centre is collected when the squad's centre is in its lane, and lost otherwise.
  // Big buffs only add, so collecting one never loses the run.
  private reachBigBuffs(): void {
    const squad = this.squad
    const bigBuffs = this.bigBuffs.active
    for (let i = bigBuffs.length - 1; i >= 0; i--) {
      const bigBuff = bigBuffs[i]
      if (bigBuff.passed || squad.z < bigBuff.z) continue
      if (laneAt(squad.x) !== bigBuff.lane) {
        bigBuff.passed = true
        continue
      }
      bigBuffGate.op = bigBuff.buff
      bigBuffGate.value = tuning.bigBuff[bigBuff.buff]
      squad.count = applyGate(squad.count, bigBuffGate)
      applyWeaponBuff(this.weapon, bigBuffGate)
      const event = this.bigBuffCollectedEvents.next()
      event.buff = bigBuff.buff
      event.squadCount = squad.count
      this.events.push(event)
      this.placeCats()
      this.bigBuffs.release(i)
    }
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
      const runStep = tuning.enemies[enemy.kind].speed * dt
      enemy.previousX = enemy.x
      enemy.previousZ = enemy.z
      enemy.z += enemy.z >= this.squad.z ? -runStep : runStep
      const toSquadX = this.squad.x - enemy.x
      enemy.x += Math.abs(toSquadX) <= enemyChaseStep ? toSquadX : Math.sign(toSquadX) * enemyChaseStep
      // Past the last cat it can touch no cat any more.
      if (enemy.z < lastCatZ - catRadius - tuning.hitRadius[enemy.kind]) this.enemies.release(i)
    }
  }

  private moveBoss(): void {
    const boss = this.state.boss
    if (boss === null) return
    boss.previousX = boss.x
    boss.previousZ = boss.z
    // The boss reaches the squad before it could reach the squad's centre, so the distance is never 0.
    const toSquadX = this.squad.x - boss.x
    const toSquadZ = this.squad.z - boss.z
    const walkStep = (tuning.bosses[boss.kind].walkSpeed * dt) / Math.hypot(toSquadX, toSquadZ)
    boss.x += toSquadX * walkStep
    boss.z += toSquadZ * walkStep
    if (boss.kind !== 'megaDustbot') return
    const throwTicks = Math.round(tuning.dustBall.interval * tuning.tickRate)
    if (boss.ticksInArena > 0 && boss.ticksInArena % throwTicks === 0) this.throwDustBall(boss)
    boss.ticksInArena++
  }

  private throwDustBall(boss: Boss): void {
    const dustBall = this.dustBalls.acquire()
    if (dustBall === undefined) return
    const toSquadX = this.squad.x - boss.x
    const toSquadZ = this.squad.z - boss.z
    const toSquad = Math.hypot(toSquadX, toSquadZ)
    dustBall.x = dustBall.previousX = boss.x
    dustBall.z = dustBall.previousZ = boss.z
    dustBall.directionX = toSquadX / toSquad
    dustBall.directionZ = toSquadZ / toSquad
    this.events.push(dustBallThrownEvent)
  }

  private removeObjectsBehind(): void {
    const lastCatZ = this.lastCatZ()
    const dustBalls = this.dustBalls.active
    for (let i = dustBalls.length - 1; i >= 0; i--) {
      if (dustBalls[i].z < lastCatZ - dustBallContactReach) this.dustBalls.release(i)
    }
    const barrels = this.barrels.active
    for (let i = barrels.length - 1; i >= 0; i--) {
      if (barrels[i].z < lastCatZ - barrelContactReach) this.barrels.release(i)
    }
    const walls = this.walls.active
    for (let i = walls.length - 1; i >= 0; i--) {
      if (walls[i].z + tuning.wall.depth < lastCatZ - catRadius) this.walls.release(i)
    }
    const buffBlocks = this.buffBlocks.active
    for (let i = buffBlocks.length - 1; i >= 0; i--) {
      if (buffBlocks[i].z + tuning.buffBlock.depth < lastCatZ - catRadius) this.buffBlocks.release(i)
    }
    const bigBuffs = this.bigBuffs.active
    for (let i = bigBuffs.length - 1; i >= 0; i--) {
      if (bigBuffs[i].z < lastCatZ) this.bigBuffs.release(i)
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
