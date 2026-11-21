import type { GateOp, Level, WaveEvent } from '../content/level'
import { tuning } from '../content/tuning'
import { drawnCats, formationOffsetX, formationOffsetZ, formationRadius } from './formation'
import { applyGate, gateColour, gateSideAt, type GateColour, type GateSide } from './gates'
import { Pool } from './pool'
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

export interface PuppyState {
  readonly x: number
  readonly z: number
  readonly previousX: number
  readonly previousZ: number
  readonly hp: number
}

export interface YarnBallState {
  readonly x: number
  readonly z: number
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
  readonly puppies: readonly PuppyState[]
  readonly yarnBalls: readonly YarnBallState[]
  readonly gateRows: readonly GateRowState[]
}

export type GameEvent =
  | { type: 'puppyKilled'; cause: 'shot' | 'contact'; x: number; z: number }
  | { type: 'catsLost'; count: number }
  | { type: 'gateTaken'; side: GateSide; op: GateOp; value: number; squadCount: number }

export interface Run {
  readonly state: RunState
  // The returned list is reused by the next step.
  step(input: SteerInput): readonly GameEvent[]
}

interface Squad {
  count: number
  x: number
  z: number
  previousX: number
  previousZ: number
  steeringPoint: number
}

interface Puppy {
  x: number
  z: number
  previousX: number
  previousZ: number
  hp: number
  // +1 while a flank puppy walks right towards the centre, −1 while it walks left, 0 once it runs straight.
  sideways: number
}

interface YarnBall {
  x: number
  z: number
  previousZ: number
  distance: number
}

interface GateCell {
  op: GateOp
  value: number
  colour: GateColour
}

interface GateRow {
  z: number
  left: GateCell
  right: GateCell
  taken: GateSide | null
}

const dt = 1 / tuning.tickRate
const halfWidth = tuning.track.halfWidth
// Fraction of the gap to the steering point closed per tick, so that 95% is closed after followTime.
const followFactor = 1 - Math.pow(20, -dt / tuning.squad.followTime)
const fireInterval = 1 / tuning.cat.fireRate
const yarnBallStep = tuning.cat.yarnBallSpeed * dt
const shotReach = tuning.hitRadius.yarnBall + tuning.hitRadius.puppy
const flankStep = (tuning.puppy.speed * dt) / Math.SQRT2

function clampToTrack(x: number): number {
  return Math.min(Math.max(x, -halfWidth), halfWidth)
}

function gateCell(op: GateOp, unsignedValue: number): GateCell {
  const value = op === 'subtract' ? -unsignedValue : unsignedValue
  return { op, value, colour: gateColour({ op, value }) }
}

class RunSimulation implements Run {
  private readonly squad: Squad
  private readonly puppies: Pool<Puppy>
  private readonly yarnBalls: Pool<YarnBall>
  private readonly gateRows: GateRow[]
  private readonly waves: WaveEvent[]
  private readonly events: GameEvent[] = []
  private readonly random: () => number
  // Time left until each cat's next shot.
  private readonly catCooldowns = new Float64Array(tuning.squad.maxCount)
  private catsWithCooldown = 0
  private nextWave = 0
  private nextGateRow = 0

  readonly state: RunState & { status: RunStatus }

  constructor(level: Level, seed: number) {
    this.random = createRng(seed)
    this.squad = { count: tuning.squad.startCount, x: 0, z: 0, previousX: 0, previousZ: 0, steeringPoint: 0 }
    this.puppies = new Pool<Puppy>(
      tuning.limits.puppies,
      () => ({ x: 0, z: 0, previousX: 0, previousZ: 0, hp: 0, sideways: 0 }),
      (puppy) => {
        puppy.x = puppy.z = puppy.previousX = puppy.previousZ = puppy.hp = puppy.sideways = 0
      },
    )
    this.yarnBalls = new Pool<YarnBall>(
      tuning.limits.yarnBalls,
      () => ({ x: 0, z: 0, previousZ: 0, distance: 0 }),
      (yarnBall) => {
        yarnBall.x = yarnBall.z = yarnBall.previousZ = yarnBall.distance = 0
      },
    )
    this.gateRows = []
    this.waves = []
    for (const event of level.events) {
      if (event.type === 'gates') {
        this.gateRows.push({
          z: event.z,
          left: gateCell(event.left.op, event.left.value),
          right: gateCell(event.right.op, event.right.value),
          taken: null,
        })
      } else {
        this.waves.push(event)
      }
    }
    this.state = {
      level,
      status: 'running',
      squad: this.squad,
      puppies: this.puppies.active,
      yarnBalls: this.yarnBalls.active,
      gateRows: this.gateRows,
    }
  }

  step(input: SteerInput): readonly GameEvent[] {
    this.events.length = 0
    if (this.state.status !== 'running') return this.events

    this.moveSquad(input)
    this.spawnWaves()
    this.shoot()
    this.moveYarnBalls()
    if (this.resolveCollisions()) return this.events
    if (this.passGates()) return this.events
    this.movePuppies()
    if (this.squad.z >= this.state.level.length) this.state.status = 'won'
    return this.events
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
  }

  private spawnWaves(): void {
    while (this.nextWave < this.waves.length && this.squad.z >= this.waves[this.nextWave].z - tuning.wave.spawnDistance) {
      this.spawnWave(this.waves[this.nextWave])
      this.nextWave++
    }
  }

  private spawnWave(wave: WaveEvent): void {
    switch (wave.pattern) {
      case 'line':
        for (let i = 0; i < wave.count; i++) {
          this.spawnPuppy(-halfWidth + (2 * halfWidth * (i + 0.5)) / wave.count, wave.z, 0)
        }
        break
      case 'block': {
        const firstX = wave.x - ((wave.columns - 1) * wave.spacing) / 2
        for (let row = 0; row < wave.rows; row++) {
          for (let column = 0; column < wave.columns; column++) {
            this.spawnPuppy(firstX + column * wave.spacing, wave.z + row * wave.spacing, 0)
          }
        }
        break
      }
      case 'column':
        for (let i = 0; i < wave.count; i++) this.spawnPuppy(wave.x, wave.z + i * wave.spacing, 0)
        break
      case 'flank':
        for (let i = 0; i < wave.count; i++) {
          this.spawnPuppy(-halfWidth, wave.z + i * wave.spacing, 1)
          this.spawnPuppy(halfWidth, wave.z + i * wave.spacing, -1)
        }
        break
    }
  }

  private spawnPuppy(x: number, z: number, sideways: number): void {
    const puppy = this.puppies.acquire()
    if (puppy === undefined) return
    puppy.x = puppy.previousX = x
    puppy.z = puppy.previousZ = z
    puppy.hp = tuning.puppy.hp
    puppy.sideways = sideways
  }

  private shoot(): void {
    const squad = this.squad
    // Cats that joined since the last tick start at a random point of their fire interval, so the squad does not fire in volleys.
    for (let cat = this.catsWithCooldown; cat < squad.count; cat++) this.catCooldowns[cat] = this.random() * fireInterval
    this.catsWithCooldown = squad.count

    const slots = drawnCats(squad.count)
    for (let cat = 0; cat < squad.count; cat++) {
      this.catCooldowns[cat] -= dt
      if (this.catCooldowns[cat] > 0) continue
      this.catCooldowns[cat] += fireInterval
      const yarnBall = this.yarnBalls.acquire()
      if (yarnBall === undefined) continue
      const slot = cat % slots
      yarnBall.x = squad.x + formationOffsetX[slot]
      yarnBall.z = yarnBall.previousZ = squad.z + formationOffsetZ[slot]
      yarnBall.distance = 0
    }
  }

  private moveYarnBalls(): void {
    for (const yarnBall of this.yarnBalls.active) {
      yarnBall.previousZ = yarnBall.z
      yarnBall.z += yarnBallStep
      yarnBall.distance += yarnBallStep
    }
  }

  // Returns true when the run is lost.
  private resolveCollisions(): boolean {
    const yarnBalls = this.yarnBalls.active
    for (let i = yarnBalls.length - 1; i >= 0; i--) {
      if (this.hitFirstTarget(yarnBalls[i]) || yarnBalls[i].distance >= tuning.cat.range) this.yarnBalls.release(i)
    }
    return this.resolveContacts()
  }

  // A yarn ball sweeps from its previous to its current z; it hits whichever puppy or gate lies first along that path.
  private hitFirstTarget(yarnBall: YarnBall): boolean {
    let hitZ = Infinity
    let hitGate: GateCell | null = null
    let hitPuppy = -1

    const row = this.gateRows[this.nextGateRow]
    if (row !== undefined && row.z > yarnBall.previousZ && row.z <= yarnBall.z) {
      hitZ = row.z
      hitGate = row[gateSideAt(yarnBall.x)]
    }

    const puppies = this.puppies.active
    for (let i = 0; i < puppies.length; i++) {
      const puppy = puppies[i]
      const dx = puppy.x - yarnBall.x
      if (Math.abs(dx) > shotReach) continue
      const halfChord = Math.sqrt(shotReach * shotReach - dx * dx)
      const touchZ = puppy.z - halfChord
      if (touchZ <= yarnBall.z && puppy.z + halfChord >= yarnBall.previousZ && touchZ < hitZ) {
        hitZ = touchZ
        hitPuppy = i
        hitGate = null
      }
    }

    if (hitPuppy >= 0) {
      const puppy = puppies[hitPuppy]
      puppy.hp -= tuning.cat.damage
      if (puppy.hp <= 0) {
        this.events.push({ type: 'puppyKilled', cause: 'shot', x: puppy.x, z: puppy.z })
        this.puppies.release(hitPuppy)
      }
      return true
    }
    if (hitGate !== null) {
      if (hitGate.op === 'add' || hitGate.op === 'subtract') {
        hitGate.value += tuning.gate.valuePerHit
        hitGate.colour = gateColour(hitGate)
      }
      return true
    }
    return false
  }

  private resolveContacts(): boolean {
    const squad = this.squad
    const reach = formationRadius(squad.count) + tuning.hitRadius.cat + tuning.hitRadius.puppy
    const puppies = this.puppies.active
    for (let i = puppies.length - 1; i >= 0; i--) {
      const dx = puppies[i].x - squad.x
      const dz = puppies[i].z - squad.z
      if (dx * dx + dz * dz > reach * reach) continue
      const catsLost = Math.min(tuning.puppy.contactDamage, squad.count)
      squad.count -= catsLost
      this.events.push({ type: 'puppyKilled', cause: 'contact', x: puppies[i].x, z: puppies[i].z })
      this.events.push({ type: 'catsLost', count: catsLost })
      this.puppies.release(i)
      if (squad.count === 0) {
        this.state.status = 'lost'
        return true
      }
    }
    return false
  }

  // Returns true when the run is lost.
  private passGates(): boolean {
    const squad = this.squad
    let row = this.gateRows[this.nextGateRow]
    while (row !== undefined && squad.z >= row.z) {
      const side = gateSideAt(squad.x)
      const gate = row[side]
      squad.count = applyGate(squad.count, gate)
      row.taken = side
      this.events.push({ type: 'gateTaken', side, op: gate.op, value: gate.value, squadCount: squad.count })
      this.nextGateRow++
      if (squad.count === 0) {
        this.state.status = 'lost'
        return true
      }
      row = this.gateRows[this.nextGateRow]
    }
    return false
  }

  private movePuppies(): void {
    const puppies = this.puppies.active
    for (let i = puppies.length - 1; i >= 0; i--) {
      const puppy = puppies[i]
      puppy.previousX = puppy.x
      puppy.previousZ = puppy.z
      if (puppy.sideways === 0) {
        puppy.z -= tuning.puppy.speed * dt
      } else {
        puppy.x += puppy.sideways * flankStep
        puppy.z -= flankStep
        if (puppy.x * puppy.sideways >= 0) {
          puppy.x = 0
          puppy.sideways = 0
        }
      }
      if (puppy.z < this.squad.z - tuning.puppy.despawnBehind) this.puppies.release(i)
    }
  }
}

export function createRun({ level, seed }: { level: Level; seed: number }): Run {
  return new RunSimulation(level, seed)
}
