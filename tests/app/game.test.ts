// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tuning } from '../../src/content/tuning'
import { Game } from '../../src/app/game'
import type { RunState } from '../../src/sim/run'
import { levelOf } from '../sim/runHarness'

// The squad's z at each drawn frame, read when the frame is drawn.
const drawnSquadZ: number[] = []

// Three.js needs WebGL, which the test environment lacks; the loop is checked through what it asks render to draw.
vi.mock('../../src/render/gameRenderer', () => ({
  GameRenderer: class {
    constructor() {
      return new Proxy(this, {
        get: (renderer, member) =>
          member === 'draw'
            ? (state: RunState) => drawnSquadZ.push(state.squad.z)
            : member === 'trackUnitsPerPixel'
              ? () => 0.01
              : (Reflect.get(renderer, member) ?? (() => {})),
      })
    }
  },
}))

const frameMilliseconds = 1000 / 60
let pendingFrame: { id: number; callback: FrameRequestCallback } | null = null
let lastFrameId = 0
let clock = 0
let visibility: DocumentVisibilityState = 'visible'
let game: Game

// Runs the frame the game asked for, if any, as the browser would at the next display refresh.
function playFrames(count: number): void {
  for (let frame = 0; frame < count; frame++) {
    clock += frameMilliseconds
    const requested = pendingFrame
    pendingFrame = null
    requested?.callback(clock)
  }
}

function setTabVisibility(state: DocumentVisibilityState): void {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  drawnSquadZ.length = 0
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
  const gameElement = document.createElement('div')
  const canvas = document.createElement('canvas')
  gameElement.append(canvas)
  document.body.append(gameElement)
  game = new Game([levelOf([], 500)], canvas, gameElement)
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
