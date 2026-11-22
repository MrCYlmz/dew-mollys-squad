// The level file format of docs/domain/levels.md.

export type GateOp = 'add' | 'subtract' | 'multiply' | 'divide'

export interface Gate {
  op: GateOp
  // Unsigned in the level file; a subtract gate of value 15 is shown as −15.
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
  enemy: 'puppy'
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

export type LevelEvent = GateRowEvent | WaveEvent

export interface Level {
  id: string
  length: number
  placeholder?: true
  events: LevelEvent[]
}
