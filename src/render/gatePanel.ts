import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from 'three'
import type { BigBuff, GateOp } from '../content/level'
import { strings } from '../content/strings'
import { tuning } from '../content/tuning'
import type { GateState } from '../sim/run'

const panelColours = { blue: 'rgba(40, 130, 255, 0.7)', red: 'rgba(240, 60, 60, 0.7)' }
const bigBuffColour = 'rgba(255, 185, 30, 0.9)'
// Matches the panel's shape on the track, so labels are not stretched.
const canvasWidth = 256
const canvasHeight = 150

// value is signed for add and subtract, as in GateState.
function gateLabel(op: GateOp, value: number): string {
  switch (op) {
    case 'add':
    case 'subtract':
      return value < 0 ? `${strings.gateMinus}${-value}` : `${strings.gatePlus}${value}`
    case 'multiply':
      return `${strings.gateTimes}${value}`
    case 'divide':
      return `${strings.gateDivide}${value}`
    case 'fireRate':
      return strings.gateFireRate.replace('{value}', String(value))
    case 'damage':
      return strings.gateDamage.replace('{value}', String(value))
    case 'multiShot':
      return strings.gateMultiShot.replace('{value}', String(value))
    case 'range':
      return strings.gateRange.replace('{value}', String(value))
  }
}

// A see-through rounded panel with its label; dispose of it with disposePanelMaterial.
function createPanelMaterial(label: string, fill: string): MeshBasicMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const context = canvas.getContext('2d')
  if (context !== null) {
    context.fillStyle = fill
    context.beginPath()
    context.roundRect(4, 4, canvasWidth - 8, canvasHeight - 8, 16)
    context.fill()
    context.lineWidth = 6
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    context.stroke()
    context.fillStyle = '#ffffff'
    context.font = 'bold 72px system-ui, sans-serif'
    // Long labels such as FIRE RATE +20% are shrunk to fit the panel.
    const fontSize = Math.min(72, Math.floor((72 * (canvasWidth - 32)) / context.measureText(label).width))
    context.font = `bold ${fontSize}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, canvasWidth / 2, canvasHeight / 2 + 4)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
}

// Gate values never change during a run, so a gate's panel is drawn once.
export function createGatePanelMaterial(gate: GateState): MeshBasicMaterial {
  return createPanelMaterial(gateLabel(gate.op, gate.value), panelColours[gate.colour])
}

// The label a buff block and its uncovered big buff show, such as ×3 or DMG +3.
export function createBigBuffMaterial(buff: BigBuff): MeshBasicMaterial {
  return createPanelMaterial(gateLabel(buff, tuning.bigBuff[buff]), bigBuffColour)
}

export function disposePanelMaterial(material: MeshBasicMaterial): void {
  material.map?.dispose()
  material.dispose()
}
