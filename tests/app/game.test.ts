// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tuning } from '../../src/content/tuning'
import { Game } from '../../src/app/game'
import type { LaunchFlags } from '../../src/app/launchFlags'
import type { GraphicsQuality } from '../../src/content/renderConfig'
import type { RunState } from '../../src/sim/run'
import { levelOf } from '../sim/runHarness'

// The squad's z at each drawn frame, read when the frame is drawn.
const drawnSquadZ: number[] = []
// The quality each renderer was created with, and every later change to it.
const createdQualities: GraphicsQuality[] = []
const qualityChanges: GraphicsQuality[] = []

// Three.js needs WebGL, which the test environment lacks; the loop is checked through what it asks render to draw.
vi.mock('../../src/render/gameRenderer', () => ({
  GameRenderer: class {
    constructor(_canvas: HTMLCanvasElement, quality: GraphicsQuality) {
      createdQualities.push(quality)
      return new Proxy(this, {
        get: (renderer, member) =>
          member === 'draw'
            ? (state: RunState) => drawnSquadZ.push(state.squad.z)
            : member === 'setQuality'
              ? (changed: GraphicsQuality) => qualityChanges.push(changed)
              : member === 'trackUnitsPerPixel'
                ? () => 0.01
                : (Reflect.get(renderer, member) ?? (() => {})),
      })
    }
  },
}))

let pendingFrame: { id: number; callback: FrameRequestCallback } | null = null
let lastFrameId = 0
let clock = 0
let visibility: DocumentVisibilityState = 'visible'
let game: Game

// Runs the frame the game asked for, if any, as the browser would at the next display refresh.
function playFrames(count: number, framesPerSecond = 60): void {
  for (let frame = 0; frame < count; frame++) {
    clock += 1000 / framesPerSecond
    const requested = pendingFrame
    pendingFrame = null
    requested?.callback(clock)
  }
}

function setTabVisibility(state: DocumentVisibilityState): void {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

function createGame(flags?: LaunchFlags): Game {
  const gameElement = document.createElement('div')
  const canvas = document.createElement('canvas')
  gameElement.append(canvas)
  document.body.append(gameElement)
  return new Game([levelOf([], 500)], canvas, gameElement, flags)
}

function playSeconds(seconds: number, framesPerSecond: number): void {
  playFrames(Math.round(seconds * framesPerSecond), framesPerSecond)
}

beforeEach(() => {
  drawnSquadZ.length = 0
  createdQualities.length = 0
  qualityChanges.length = 0
  pendingFrame = null
  clock = 0
  visibility = 'visible'
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrame = { id: ++lastFrameId, callback }
    return lastFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (pendingFrame?.id === id) pendingFrame = null
  })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility === 'hidden' })
  game = createGame()
})

afterEach(() => {
  game.dispose()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

// requirements S-7 (8): the render loop pauses when the tab is hidden and resumes cleanly without a catch-up
// burst of sim ticks.
describe('game loop and a hidden tab', () => {
  it('no_frame_is_drawn_while_the_tab_is_hidden', () => {
    game.play()
    playFrames(30)
    setTabVisibility('hidden')
    drawnSquadZ.length = 0

    playFrames(120)

    expect(drawnSquadZ).toHaveLength(0)
  })

  it('drawing_resumes_when_the_tab_is_visible_again', () => {
    game.play()
    playFrames(30)
    setTabVisibility('hidden')
    playFrames(120)
    setTabVisibility('visible')
    drawnSquadZ.length = 0

    playFrames(10)

    expect(drawnSquadZ.length).toBeGreaterThan(0)
  })

  it('run_does_not_catch_up_the_time_the_tab_was_hidden', () => {
    game.play()
    playFrames(60)
    const squadZBeforeHiding = drawnSquadZ.at(-1) ?? Number.NaN
    setTabVisibility('hidden')
    // The browser sends no frames to a hidden tab, so the next frame's timestamp is 30 s later.
    clock += 30_000
    setTabVisibility('visible')
    playFrames(1)
    game.resume()
    playFrames(2)

    // At most the two frames played after resuming, plus one tick a frame boundary may carry over.
    const allowedTicks = 3
    const squadZAfterResuming = drawnSquadZ.at(-1) ?? Number.NaN
    expect(squadZAfterResuming - squadZBeforeHiding).toBeLessThanOrEqual((tuning.squad.forwardSpeed * allowedTicks) / tuning.tickRate + 1e-9)
  })

  it('run_still_moves_after_the_tab_comes_back', () => {
    game.play()
    playFrames(60)
    setTabVisibility('hidden')
    clock += 30_000
    setTabVisibility('visible')
    playFrames(1)
    game.resume()
    const squadZAtResume = drawnSquadZ.at(-1) ?? Number.NaN

    playFrames(60)

    expect(drawnSquadZ.at(-1)).toBeGreaterThan(squadZAtResume)
  })
})

// requirements S-7 (7) and decisions.md: until the settings screen, a start that runs strictly below 45 fps over
// its first 3 s of play switches to low graphics, once; a ?graphics flag forces the choice.
describe('graphics quality start-up check', () => {
  it('game_starts_at_high_graphics', () => {
    expect(createdQualities).toEqual(['high'])
  })

  it('three_seconds_of_play_below_45_fps_switch_to_low_graphics', () => {
    game.play()
    playSeconds(3.5, 30)

    expect(qualityChanges).toEqual(['low'])
  })

  it('switch_waits_for_three_seconds_of_play', () => {
    game.play()
    playSeconds(2.5, 30)

    expect(qualityChanges).toEqual([])
  })

  it('play_at_45_fps_keeps_high_graphics', () => {
    game.play()
    playSeconds(4, 45)

    expect(qualityChanges).toEqual([])
  })

  it('play_at_60_fps_keeps_high_graphics', () => {
    game.play()
    playSeconds(4, 60)

    expect(qualityChanges).toEqual([])
  })

  it('switch_to_low_graphics_happens_only_once', () => {
    game.play()
    playSeconds(10, 30)
    game.restart()
    playSeconds(10, 30)

    expect(qualityChanges).toEqual(['low'])
  })

  it('fast_start_is_not_checked_again_later', () => {
    game.play()
    playSeconds(4, 60)
    playSeconds(10, 20)

    expect(qualityChanges).toEqual([])
  })

  it('slow_frames_on_the_title_screen_do_not_count', () => {
    playSeconds(5, 20)
    game.play()
    playSeconds(4, 60)

    expect(qualityChanges).toEqual([])
  })

  it('slow_frames_while_paused_do_not_count', () => {
    game.play()
    playSeconds(1, 60)
    game.pause()
    playSeconds(5, 20)
    game.resume()
    playSeconds(3, 60)

    expect(qualityChanges).toEqual([])
  })

  it('forced_high_graphics_stays_high_on_a_slow_start', () => {
    game.dispose()
    createdQualities.length = 0
    game = createGame({ perf: false, stress: false, graphics: 'high', level: null })
    game.play()
    playSeconds(5, 20)

    expect(createdQualities).toEqual(['high'])
    expect(qualityChanges).toEqual([])
  })

  it('forced_low_graphics_stays_low_on_a_fast_start', () => {
    game.dispose()
    createdQualities.length = 0
    game = createGame({ perf: false, stress: false, graphics: 'low', level: null })
    game.play()
    playSeconds(5, 60)

    expect(createdQualities).toEqual(['low'])
    expect(qualityChanges).toEqual([])
  })
})
