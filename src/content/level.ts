// The level file format of docs/domain/levels.md.

export type GateOp = 'add' | 'subtract' | 'multiply' | 'divide' | WeaponBuffOp

export type WeaponBuffOp = 'fireRate' | 'damage' | 'multiShot' | 'range'

export type EnemyKind = 'puppy' | 'chihuahua' | 'bulldog' | 'shieldDog'

export type BossKind = 'dustbot' | 'megaDustbot'

export type Lane = 'left' | 'centre' | 'right'

export type BigBuff = 'add' | 'multiply' | WeaponBuffOp

export interface Gate {
  op: GateOp
  // Unsigned in the level file; a subtract gate of value 15 is shown as −15. A fire rate gate's value is in per cent.
  value: number
}

// A lane without a gate is empty; a row has at least one gate.
export interface GateRowEvent {
  type: 'gates'
  z: number
  left?: Gate
  centre?: Gate
  right?: Gate
}

interface WaveBase {
  type: 'wave'
  z: number
  enemy: EnemyKind
}

export interface LineWave extends WaveBase {
  pattern: 'line'
  count: number
}

export interface BlockWave extends WaveBase {
  pattern: 'block'
  columns: number
  rows: number
  x: number
  spacing: number
}

export interface ColumnWave extends WaveBase {
  pattern: 'column'
  count: number
  x: number
  spacing: number
}

export interface FlankWave extends WaveBase {
  pattern: 'flank'
  count: number
  spacing: number
}

export type WaveEvent = LineWave | BlockWave | ColumnWave | FlankWave

export interface BarrelEvent {
  type: 'barrel'
  z: number
  x: number
}

export interface WallEvent {
  type: 'wall'
  // The wall's front edge, facing the squad; it reaches back by the wall depth.
  z: number
  // The wall's centre across the track.
  x: number
  width: number
}

export interface BuffBlockEvent {
  type: 'buffBlock'
  // The block's front edge, facing the squad; it reaches back by the buff block depth.
  z: number
  lane: Lane
  // At level 1; it scales like enemy HP.
  hp: number
  buff: BigBuff
}

export interface BossEvent {
  type: 'boss'
  // The arena start, equal to the level's length.
  z: number
  boss: BossKind
}

// The endless enemies besides the waves, from the start of the run until the finish line or the arena start.
export interface Stream {
  // Seconds between two stream enemies.
  interval: number
  // Sent in this order, then again from the start.
  enemies: EnemyKind[]
}

export type LevelEvent = GateRowEvent | WaveEvent | BarrelEvent | WallEvent | BuffBlockEvent | BossEvent

export interface Level {
  id: string
  // The level number, which sets enemy HP and wave size scaling.
  level: number
  length: number
  placeholder?: true
  // Required in a level with a boss, whose HP it sets, and absent otherwise.
  expectedSquadAtBoss?: number
  stream: Stream
  events: LevelEvent[]
}
