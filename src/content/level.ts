// The level file format of docs/domain/levels.md.

export type GateOp = 'add' | 'subtract' | 'multiply' | 'divide' | WeaponBuffOp

export type WeaponBuffOp = 'fireRate' | 'damage' | 'multiShot' | 'range'

export type EnemyKind = 'puppy' | 'chihuahua' | 'bulldog' | 'shieldDog'

export interface Gate {
  op: GateOp
  // Unsigned in the level file; a subtract gate of value 15 is shown as −15. A fire rate gate's value is in per cent.
  value: number
}

export interface GateRowEvent {
  type: 'gates'
  z: number
  left: Gate
  right: Gate
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

export type LevelEvent = GateRowEvent | WaveEvent | BarrelEvent | WallEvent

export interface Level {
  id: string
  // The level number, which sets enemy HP and wave size scaling.
  level: number
  length: number
  placeholder?: true
  events: LevelEvent[]
}
