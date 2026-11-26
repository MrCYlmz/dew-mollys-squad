// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Game } from '../../src/app/game'
import type { RunState } from '../../src/sim/run'
import { levelOf } from '../sim/runHarness'

// requirements S-12 (2): a switching gate switches with run time, so it stops while the game is paused.

// The op the switching gate showed at each drawn frame.
const drawnFaces: string[] = []

// Three.js needs WebGL, which the test environment lacks; the gate is checked through what render is asked to draw.
vi.mock('../../src/render/gameRenderer', () => ({
  GameRenderer: class {
    constructor() {
      return new Proxy(this, {
        get: (renderer, member) =>
          member === 'draw'
            ? (state: RunState) => drawnFaces.push(state.gateRows[0]?.left?.op ?? '')
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
let game: Game

function playFrames(count: number): void {
  for (let frame = 0; frame < count; frame++) {
    clock += 1000 / 60
    const requested = pendingFrame
    pendingFrame = null
    requested?.callback(clock)
  }
}

beforeEach(() => {
  drawnFaces.length = 0
  pendingFrame = null
  clock = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrame = { id: ++lastFrameId, callback }
    return lastFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (pendingFrame?.id === id) pendingFrame = null
  })
  const gameElement = document.createElement('div')
  const canvas = document.createElement('canvas')
  gameElement.append(canvas)
  document.body.append(gameElement)
  // A row far down the road, so the gate is still ahead of the squad when the test ends.
  game = new Game([levelOf([{ type: 'gates', z: 250, left: { op: 'add', value: 10, switchTo: { op: 'subtract', value: 15 } } }], 300)], canvas, gameElement)
})

afterEach(() => {
  game.dispose()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('switching gate and pause', () => {
  // About 0.8 s of play, 1 s paused and 0.4 s more of play is about 1.2 s of run time, in the second face's second, while
  // 2.2 s of clock time would be back in the own face's.
  it('switching_gate_does_not_switch_while_the_game_is_paused', () => {
    game.play()
    playFrames(48)
    game.pause()
    playFrames(60)
    game.resume()

    playFrames(24)

    expect(drawnFaces.at(-1)).toBe('subtract')
  })

  it('switching_gate_shows_its_own_face_for_the_first_second_of_play', () => {
    game.play()

    playFrames(48)

    expect(drawnFaces.at(-1)).toBe('add')
  })
})
