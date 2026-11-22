import { RepeatWrapping, type CanvasTexture } from 'three'
import { renderConfig } from '../content/renderConfig'
import { createCanvasTexture, cssColour } from './canvasTexture'

// Small textures drawn in code, so the game downloads no images.

function repeating(texture: CanvasTexture): CanvasTexture {
  texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

function flecks(context: CanvasRenderingContext2D, colour: number, count: number, size: number): void {
  const { width, height } = context.canvas
  context.fillStyle = cssColour(colour)
  for (let i = 0; i < count; i++) context.fillRect(Math.random() * width, Math.random() * height, size, size)
}

// Mown stripes across the track's direction, so the ground's movement shows.
export function createGrassTexture(): CanvasTexture {
  const { grass, grassStripe, grassFleck } = renderConfig.ground
  return repeating(
    createCanvasTexture(64, 64, (context) => {
      context.fillStyle = cssColour(grass)
      context.fillRect(0, 0, 64, 64)
      context.fillStyle = cssColour(grassStripe)
      context.fillRect(0, 0, 64, 32)
      flecks(context, grassFleck, 90, 2)
    }),
  )
}

// Four paving slabs laid in a bond.
export function createTrackTexture(): CanvasTexture {
  const { surface, slabLine, fleck } = renderConfig.track
  return repeating(
    createCanvasTexture(128, 128, (context) => {
      context.fillStyle = cssColour(surface)
      context.fillRect(0, 0, 128, 128)
      flecks(context, fleck, 160, 2)
      context.fillStyle = cssColour(slabLine)
      context.fillRect(0, 0, 128, 2)
      context.fillRect(0, 64, 128, 2)
      context.fillRect(0, 0, 2, 64)
      context.fillRect(64, 0, 2, 64)
      context.fillRect(32, 64, 2, 64)
      context.fillRect(96, 64, 2, 64)
    }),
  )
}

// Eight squares across and two along.
export function createFinishTexture(): CanvasTexture {
  const { finishLight, finishDark } = renderConfig.track
  return createCanvasTexture(128, 32, (context) => {
    for (let column = 0; column < 8; column++) {
      for (let row = 0; row < 2; row++) {
        context.fillStyle = cssColour((column + row) % 2 === 0 ? finishLight : finishDark)
        context.fillRect(column * 16, row * 16, 16, 16)
      }
    }
  })
}

// Two rows of bricks, the second shifted by half a brick.
export function createBrickTexture(): CanvasTexture {
  const { brick, brickDark, mortar } = renderConfig.wall
  return repeating(
    createCanvasTexture(128, 64, (context) => {
      context.fillStyle = cssColour(mortar)
      context.fillRect(0, 0, 128, 64)
      for (let row = 0; row < 2; row++) {
        for (let column = -1; column < 2; column++) {
          context.fillStyle = cssColour((row + column) % 2 === 0 ? brick : brickDark)
          context.fillRect(column * 64 + row * 32 + 3, row * 32 + 3, 58, 26)
        }
      }
    }),
  )
}

// Cracks over a crate face, as fractions of its width and height; each damage stage adds the next ones.
const cracks: readonly (readonly number[])[] = [
  [0.5, 0, 0.46, 0.25, 0.54, 0.4, 0.5, 0.6],
  [0, 0.7, 0.18, 0.62, 0.3, 0.75, 0.42, 0.68],
  [1, 0.3, 0.82, 0.38, 0.72, 0.28, 0.6, 0.36],
  [0.5, 0.6, 0.62, 0.78, 0.58, 1],
  [0.2, 0, 0.26, 0.2, 0.16, 0.34, 0.28, 0.48],
  [0.8, 1, 0.74, 0.8, 0.86, 0.66, 0.78, 0.52],
]
const cracksPerStage = [0, 1, 3, 6]

// The faces of a buff block crate side by side, one per damage stage from whole to nearly broken.
export function createCrateTexture(): CanvasTexture {
  const { wood, plank, frame, crack, damageStages } = renderConfig.buffBlock
  const cellWidth = 128
  const cellHeight = 64
  return createCanvasTexture(cellWidth * damageStages, cellHeight, (context) => {
    for (let stage = 0; stage < damageStages; stage++) {
      const left = stage * cellWidth
      context.fillStyle = cssColour(wood)
      context.fillRect(left, 0, cellWidth, cellHeight)
      context.fillStyle = cssColour(plank)
      for (let line = 1; line < 4; line++) context.fillRect(left, line * 16 - 1, cellWidth, 2)
      context.strokeStyle = cssColour(frame)
      context.lineWidth = 8
      context.strokeRect(left + 4, 4, cellWidth - 8, cellHeight - 8)
      context.beginPath()
      context.moveTo(left + 8, cellHeight - 8)
      context.lineTo(left + cellWidth - 8, 8)
      context.stroke()
      context.strokeStyle = cssColour(crack)
      context.lineWidth = 2.5
      for (const points of cracks.slice(0, cracksPerStage[Math.min(stage, cracksPerStage.length - 1)])) {
        context.beginPath()
        context.moveTo(left + points[0] * cellWidth, points[1] * cellHeight)
        for (let i = 2; i < points.length; i += 2) context.lineTo(left + points[i] * cellWidth, points[i + 1] * cellHeight)
        context.stroke()
      }
    }
  })
}

// A soft round glow, fading out to the edge.
export function createGlowTexture(): CanvasTexture {
  const glow = cssColour(renderConfig.bigBuff.glow)
  return createCanvasTexture(64, 64, (context) => {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, glow)
    // Eight hex digits: the same colour, fully transparent.
    gradient.addColorStop(1, `${glow}00`)
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  })
}
