import { MeshBasicMaterial } from 'three'
import type { BigBuff, GateOp } from '../content/level'
import { renderConfig } from '../content/renderConfig'
import { strings } from '../content/strings'
import { tuning } from '../content/tuning'
import type { GateState } from '../sim/run'
import { createCanvasTexture, cssColour } from './canvasTexture'

const panel = renderConfig.panel
const panelColours = { blue: renderConfig.gate.good, red: renderConfig.gate.bad }
// Matches the panel's shape on the track, so labels are not stretched.
const canvasWidth = 256
const canvasHeight = 150
const glowBlur = panel.glowBlur

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

// A see-through glowing panel with its label in bold; dispose of it with disposePanelMaterial.
function createPanelMaterial(label: string, fill: number): MeshBasicMaterial {
  const texture = createCanvasTexture(canvasWidth, canvasHeight, (context) => {
    const inset = glowBlur
    const width = canvasWidth - 2 * inset
    const height = canvasHeight - 2 * inset
    // Lighter at the top, so the panel reads as lit glass.
    const gradient = context.createLinearGradient(0, inset, 0, inset + height)
    gradient.addColorStop(0, cssColour(panel.border))
    gradient.addColorStop(0.35, cssColour(fill))
    gradient.addColorStop(1, cssColour(fill))
    context.shadowColor = cssColour(fill)
    context.shadowBlur = glowBlur
    context.globalAlpha = panel.opacity
    context.fillStyle = gradient
    context.beginPath()
    context.roundRect(inset, inset, width, height, 18)
    context.fill()
    context.globalAlpha = 1
    context.shadowColor = cssColour(panel.border)
    context.lineWidth = 6
    context.strokeStyle = cssColour(panel.border)
    context.stroke()
    context.shadowBlur = 0
    context.font = 'bold 76px system-ui, sans-serif'
    // Long labels such as FIRE RATE +20% are shrunk to fit the panel.
    const fontSize = Math.min(76, Math.floor((76 * (width - 24)) / context.measureText(label).width))
    context.font = `bold ${fontSize}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.lineWidth = Math.max(fontSize / 8, 3)
    context.strokeStyle = cssColour(panel.textOutline)
    context.strokeText(label, canvasWidth / 2, canvasHeight / 2 + 4)
    context.fillStyle = cssColour(panel.text)
    context.fillText(label, canvasWidth / 2, canvasHeight / 2 + 4)
  })
  return new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
}

// Gate values never change during a run, so a gate's panel is drawn once.
export function createGatePanelMaterial(gate: GateState): MeshBasicMaterial {
  return createPanelMaterial(gateLabel(gate.op, gate.value), panelColours[gate.colour])
}

// The label a buff block and its uncovered big buff show, such as ×3 or DMG +3.
export function createBigBuffMaterial(buff: BigBuff): MeshBasicMaterial {
  return createPanelMaterial(gateLabel(buff, tuning.bigBuff[buff]), renderConfig.bigBuff.label)
}

export function disposePanelMaterial(material: MeshBasicMaterial): void {
  material.map?.dispose()
  material.dispose()
}
