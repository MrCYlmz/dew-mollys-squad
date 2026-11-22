import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Quaternion,
} from 'three'
import { renderConfig } from '../content/renderConfig'
import { shownHp } from '../sim/hp'
import { createCanvasTexture, cssColour } from './canvasTexture'

const glyphWidth = 32
const glyphHeight = 48
const { digitWidth, digitHeight } = renderConfig.hpLabel
const maxDigits = 3

const matrix = new Matrix4()
const position = new Vector3()
const scale = new Vector3()
const textColour = new Color(renderConfig.hpLabel.text)

// The digits 0–9 side by side on one texture; each digit quad shows the tenth of it its glyph attribute picks.
export function createDigitMaterial(): MeshBasicMaterial {
  const texture = createCanvasTexture(glyphWidth * 10, glyphHeight, (context) => {
    context.font = `bold ${glyphHeight - 8}px system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineWidth = 6
    context.strokeStyle = cssColour(renderConfig.hpLabel.outline)
    context.fillStyle = cssColour(renderConfig.hpLabel.text)
    for (let digit = 0; digit < 10; digit++) {
      const x = glyphWidth * (digit + 0.5)
      context.strokeText(String(digit), x, glyphHeight / 2 + 2)
      context.fillText(String(digit), x, glyphHeight / 2 + 2)
    }
  })
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float glyph;\nvoid main() {')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvMapUv.x = (vMapUv.x + glyph) / 10.0;')
  }
  return material
}

// HP numbers over enemies and barrels, one instanced quad per digit, so all of them are one draw call.
export class HpLabels {
  readonly mesh: InstancedMesh
  private readonly geometry = new PlaneGeometry(digitWidth, digitHeight)
  private readonly glyphs: InstancedBufferAttribute

  constructor(
    material: MeshBasicMaterial,
    numbers: number,
    private readonly facing: Quaternion,
  ) {
    const capacity = Math.max(numbers * maxDigits, 1)
    this.glyphs = new InstancedBufferAttribute(new Float32Array(capacity), 1)
    this.geometry.setAttribute('glyph', this.glyphs)
    this.mesh = new InstancedMesh(this.geometry, material, capacity)
    // Colours are set up front, so the first coloured frame compiles no new shader.
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, textColour)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
  }

  begin(): void {
    this.mesh.count = 0
  }

  // Shows hp rounded up, centred on (x, y, z) in world units, size times the normal digit size.
  add(hp: number, x: number, y: number, z: number, colour: Color, size = 1): void {
    const shown = Math.min(shownHp(hp), 10 ** maxDigits - 1)
    const digits = shown >= 100 ? 3 : shown >= 10 ? 2 : 1
    let rest = shown
    for (let i = digits - 1; i >= 0; i--) {
      const index = this.mesh.count++
      this.glyphs.setX(index, rest % 10)
      rest = Math.floor(rest / 10)
      matrix.compose(position.set(x + (i - (digits - 1) / 2) * digitWidth * 0.8 * size, y, z), this.facing, scale.setScalar(size))
      this.mesh.setMatrixAt(index, matrix)
      this.mesh.setColorAt(index, colour)
    }
  }

  finish(): void {
    this.mesh.instanceMatrix.needsUpdate = true
    this.glyphs.needsUpdate = true
    if (this.mesh.instanceColor !== null) this.mesh.instanceColor.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.mesh.dispose()
  }
}
