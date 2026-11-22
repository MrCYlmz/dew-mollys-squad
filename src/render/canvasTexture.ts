import { CanvasTexture, SRGBColorSpace } from 'three'

// A render config colour as a CSS colour for drawing on a canvas.
export function cssColour(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`
}

// A texture drawn once on a new canvas; without a 2D context it stays blank.
export function createCanvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context !== null) draw(context)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
