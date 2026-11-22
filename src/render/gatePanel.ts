import { CanvasTexture, Mesh, MeshBasicMaterial, SRGBColorSpace, type PlaneGeometry } from 'three'
import { strings } from '../content/strings'
import type { GateState } from '../sim/run'

const panelColours = { blue: 'rgba(40, 130, 255, 0.7)', red: 'rgba(240, 60, 60, 0.7)' }

function gateLabel(gate: GateState): string {
  switch (gate.op) {
    case 'add':
    case 'subtract':
      if (gate.value > 0) return `${strings.gatePlus}${gate.value}`
      if (gate.value < 0) return `${strings.gateMinus}${-gate.value}`
      return String(gate.value)
    case 'multiply':
      return `${strings.gateTimes}${gate.value}`
    case 'divide':
      return `${strings.gateDivide}${gate.value}`
    case 'fireRate':
      return `${strings.gateFireRate} ${strings.gatePlus}${gate.value}%`
    case 'damage':
      return `${strings.gateDamage} ${strings.gatePlus}${gate.value}`
    case 'multiShot':
      return `${strings.gatePlus}${gate.value} ${strings.gateMultiShot}`
    case 'range':
      return `${strings.gateRange} ${strings.gatePlus}${gate.value}`
  }
}

// One gate of a gate row: a see-through panel with its value, redrawn only when the value changes.
export class GatePanel {
  readonly mesh: Mesh
  private readonly canvas = document.createElement('canvas')
  private readonly texture: CanvasTexture
  private readonly material: MeshBasicMaterial
  private shownValue = Number.NaN

  constructor(geometry: PlaneGeometry) {
    this.canvas.width = 256
    this.canvas.height = 128
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.material = new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false })
    this.mesh = new Mesh(geometry, this.material)
  }

  show(gate: GateState): void {
    if (gate.value === this.shownValue) return
    this.shownValue = gate.value
    const context = this.canvas.getContext('2d')
    if (context === null) return
    const { width, height } = this.canvas
    context.clearRect(0, 0, width, height)
    context.fillStyle = panelColours[gate.colour]
    context.beginPath()
    context.roundRect(4, 4, width - 8, height - 8, 16)
    context.fill()
    context.lineWidth = 6
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    context.stroke()
    context.fillStyle = '#ffffff'
    const label = gateLabel(gate)
    context.font = 'bold 72px system-ui, sans-serif'
    // Long labels such as FIRE RATE +20% are shrunk to fit the panel.
    const fontSize = Math.min(72, Math.floor((72 * (width - 32)) / context.measureText(label).width))
    context.font = `bold ${fontSize}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, width / 2, height / 2 + 4)
    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
    this.material.dispose()
  }
}
