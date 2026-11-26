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

// Saturation and lightness, 0 to 1, of a 0xRRGGBB colour.
function saturationAndLightnessOf(colour: number): { saturation: number; lightness: number } {
  const channels = [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff].map((channel) => channel / 255)
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  const lightness = (max + min) / 2
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1))
  return { saturation, lightness }
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

  // requirements S-12 (3): a mystery gate has its own colour, neither blue nor red: purple.
  it('mystery_gates_are_purple', () => {
    const hue = hueOf(renderConfig.gate.mystery)
    expect(hue).toBeGreaterThan(260)
    expect(hue).toBeLessThan(320)
    expect(saturationAndLightnessOf(renderConfig.gate.mystery).saturation).toBeGreaterThan(0.4)
  })
})

// requirements S-12 (5–6): the greyhound is grey; the dalmatian is white with black spots.
describe('dog look', () => {
  it('greyhound_coat_is_grey', () => {
    const { saturation, lightness } = saturationAndLightnessOf(renderConfig.dogs.greyhound.coat)
    expect(saturation).toBeLessThan(0.15)
    expect(lightness).toBeGreaterThan(0.3)
    expect(lightness).toBeLessThan(0.8)
  })

  it('dalmatian_coat_is_white', () => {
    expect(saturationAndLightnessOf(renderConfig.dogs.dalmatian.coat).lightness).toBeGreaterThan(0.9)
  })

  it('dalmatian_spots_are_black', () => {
    expect(saturationAndLightnessOf(renderConfig.dogs.dalmatian.spot).lightness).toBeLessThan(0.15)
  })
})

// requirements S-12 (9) and docs/domain/run.md "Visibility": a place the stretched spawn distance ahead of the squad, at
// most 40 × 1.98 = 79.2 units on levels 15–25, is drawn at least at half strength. The render config gives the fog's
// start and end as distances ahead of the squad, with half strength halfway between them.
describe('fog', () => {
  const longestSpawnDistance = 79.2

  it('fog_is_at_most_half_strength_at_the_stretched_spawn_distance_of_level_15', () => {
    const { nearAhead, farAhead } = renderConfig.fog
    expect((nearAhead + farAhead) / 2).toBeGreaterThanOrEqual(longestSpawnDistance)
  })

  it('fog_starts_ahead_of_the_squad_and_ends_beyond_where_it_starts', () => {
    expect(renderConfig.fog.nearAhead).toBeGreaterThan(0)
    expect(renderConfig.fog.farAhead).toBeGreaterThan(renderConfig.fog.nearAhead)
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
