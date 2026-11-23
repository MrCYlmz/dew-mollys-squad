import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderConfig } from '../../src/content/renderConfig'

// Hue in degrees, 0 to 360, of a 0xRRGGBB colour.
function hueOf(colour: number): number {
  const red = ((colour >> 16) & 0xff) / 255
  const green = ((colour >> 8) & 0xff) / 255
  const blue = (colour & 0xff) / 255
  const max = Math.max(red, green, blue)
  const range = max - Math.min(red, green, blue)
  if (range === 0) return 0
  const sector = max === red ? (green - blue) / range : max === green ? (blue - red) / range + 2 : (red - green) / range + 4
  return (sector * 60 + 360) % 360
}

describe('cat look', () => {
  it('cat_fur_colours_are_orange_grey_black_white_and_calico', () => {
    expect(Object.keys(renderConfig.cat.fur).sort()).toEqual(['black', 'calico', 'grey', 'orange', 'white'])
  })
})

// docs/domain/run.md: add, multiply and weapon-buff gates are blue; subtract and divide gates are red.
describe('gate look', () => {
  it('good_gates_are_blue', () => {
    const hue = hueOf(renderConfig.gate.good)
    expect(hue).toBeGreaterThanOrEqual(180)
    expect(hue).toBeLessThanOrEqual(260)
  })

  it('bad_gates_are_red', () => {
    const hue = hueOf(renderConfig.gate.bad)
    expect(hue < 20 || hue > 340).toBe(true)
  })
})

// docs/domain/screens.md and the playbook: low graphics turns off shadows and caps devicePixelRatio at 1.5.
describe('graphics quality', () => {
  it('high_graphics_has_shadows', () => {
    expect(renderConfig.graphics.high.shadows).toBe(true)
  })

  it('low_graphics_has_no_shadows', () => {
    expect(renderConfig.graphics.low.shadows).toBe(false)
  })

  it('low_graphics_caps_pixel_ratio_at_1_5', () => {
    expect(renderConfig.graphics.low.maxPixelRatio).toBe(1.5)
  })

  it('high_graphics_renders_at_least_the_low_resolution', () => {
    expect(renderConfig.graphics.high.maxPixelRatio).toBeGreaterThanOrEqual(renderConfig.graphics.low.maxPixelRatio)
  })

  // requirements S-7 (7): "high" caps devicePixelRatio at 2.
  it('high_graphics_caps_pixel_ratio_at_2', () => {
    expect(renderConfig.graphics.high.maxPixelRatio).toBe(2)
  })
})

// Colours are the look values a source scan can find; sizes and light strengths are left to review.
describe('one render config', () => {
  const renderFolder = fileURLToPath(new URL('../../src/render/', import.meta.url))
  const renderFileNames = readdirSync(renderFolder, { recursive: true, encoding: 'utf8' }).filter((name) => name.endsWith('.ts'))
  const colourLiteral = /\b0x[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/

  it.each(renderFileNames)('render_file_%s_takes_its_colours_from_the_render_config', (fileName) => {
    const colourLines = readFileSync(renderFolder + fileName, 'utf8')
      .split('\n')
      .filter((line) => colourLiteral.test(line))
    expect(colourLines).toEqual([])
  })
})
