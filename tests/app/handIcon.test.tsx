// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { Game } from '../../src/app/game'
import type { Level } from '../../src/content/level'
import { strings } from '../../src/content/strings'
import type { RunState } from '../../src/sim/run'
import { levelOf } from '../sim/runHarness'

// requirements S-6 (11–13) and docs/domain/screens.md "Hand icon": on every start of level 1 a hand icon shows how to
// steer, until the first steer input or 4 s of run time, and never on another level.

// The squad at each drawn frame, read when the frame is drawn.
const drawnSquads: { z: number; steeringPoint: number }[] = []
const pixelsPerTrackUnit = 100

// Three.js needs WebGL, which the test environment lacks; the run is checked through what it asks render to draw.
vi.mock('../../src/render/gameRenderer', () => ({
  GameRenderer: class {
    constructor() {
      return new Proxy(this, {
        get: (renderer, member) =>
          member === 'draw'
            ? (state: RunState) => drawnSquads.push({ z: state.squad.z, steeringPoint: state.squad.steeringPoint })
            : member === 'trackUnitsPerPixel'
              ? () => 1 / pixelsPerTrackUnit
              : (Reflect.get(renderer, member) ?? (() => {})),
      })
    }
  },
}))

// A wall across the whole track 10 s into level 1, so a run can be lost on purpose.
const wallAt = 120
const level1: Level = { ...levelOf([{ type: 'wall', z: wallAt, x: 0, width: 10 }], 500, 1), id: 'level-1' }
const level2: Level = { ...levelOf([], 500, 2), id: 'level-2' }

let pendingFrame: { id: number; callback: FrameRequestCallback } | null = null
let lastFrameId = 0
let clock = 0
let game: Game
let gameElement: HTMLElement

async function playFrames(count: number): Promise<void> {
  await act(() => {
    for (let frame = 0; frame < count; frame++) {
      clock += 1000 / 60
      const requested = pendingFrame
      pendingFrame = null
      requested?.callback(clock)
    }
  })
}

async function playSeconds(seconds: number): Promise<void> {
  await playFrames(Math.round(seconds * 60))
}

function handIcon(): HTMLElement | null {
  return screen.queryByRole('img')
}

async function startLevel1(): Promise<void> {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: new RegExp(strings.tapToPlay) }))
  // The first frame only sets the loop's clock.
  await playFrames(1)
}

async function drag(from: Element, pixels: number): Promise<void> {
  await act(() => {
    from.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 200, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 200 + pixels, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 200 + pixels, bubbles: true }))
  })
}

async function pressSteeringKey(): Promise<void> {
  await act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))
  })
  await playFrames(1)
  await act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }))
  })
}

beforeEach(async () => {
  drawnSquads.length = 0
  pendingFrame = null
  clock = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrame = { id: ++lastFrameId, callback }
    return lastFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (pendingFrame?.id === id) pendingFrame = null
  })
  gameElement = document.createElement('div')
  const canvas = document.createElement('canvas')
  const uiRoot = document.createElement('div')
  gameElement.append(canvas, uiRoot)
  document.body.append(gameElement)
  game = new Game([level2, level1], canvas, gameElement)
  render(<App loadGame={() => Promise.resolve(game)} />, { container: uiRoot })
  await startLevel1()
})

afterEach(() => {
  cleanup()
  game.dispose()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('hand icon on level 1', () => {
  it('hand_icon_shows_when_level_1_starts', () => {
    expect(handIcon()).not.toBeNull()
  })

  it('hand_icon_has_no_text', () => {
    expect(handIcon()?.textContent?.trim()).toBe('')
  })

  it('hand_icon_stays_until_4_seconds_into_the_run_without_steering', async () => {
    await playSeconds(3.9)

    expect(handIcon()).not.toBeNull()
  })

  it('hand_icon_disappears_4_seconds_into_the_run', async () => {
    await playSeconds(4.1)

    expect(handIcon()).toBeNull()
  })

  // The example from docs/domain/screens.md: the player drags after 2 s; the hand icon disappears at once.
  it('first_drag_hides_the_hand_icon_at_once', async () => {
    await playSeconds(2)
    await drag(gameElement, 50)
    await playFrames(1)

    expect(handIcon()).toBeNull()
  })

  it('first_steering_key_hides_the_hand_icon_at_once', async () => {
    await playSeconds(2)
    await pressSteeringKey()

    expect(handIcon()).toBeNull()
  })

  it('hand_icon_does_not_come_back_in_that_run', async () => {
    await playSeconds(1)
    await drag(gameElement, 50)
    await playSeconds(5)

    expect(handIcon()).toBeNull()
  })

  it('hand_icon_hidden_by_time_does_not_come_back_after_a_pause', async () => {
    const user = userEvent.setup()
    await playSeconds(4.1)
    await user.click(screen.getByRole('button', { name: strings.pause }))
    await user.click(screen.getByRole('button', { name: strings.resume }))
    await playSeconds(1)

    expect(handIcon()).toBeNull()
  })

  it('time_paused_does_not_count_toward_the_4_seconds', async () => {
    const user = userEvent.setup()
    await playSeconds(2)
    await user.click(screen.getByRole('button', { name: strings.pause }))
    await playSeconds(10)
    await user.click(screen.getByRole('button', { name: strings.resume }))
    // The first frame after resuming only sets the loop's clock again.
    await playFrames(1)
    await playSeconds(1.5)

    expect(handIcon()).not.toBeNull()

    await playSeconds(1)

    expect(handIcon()).toBeNull()
  })

  it('hand_icon_shows_again_when_level_1_is_restarted', async () => {
    const user = userEvent.setup()
    await playSeconds(1)
    await drag(gameElement, 50)
    await playFrames(1)
    await user.click(screen.getByRole('button', { name: strings.pause }))
    await user.click(screen.getByRole('button', { name: strings.restart }))
    await playFrames(1)

    expect(handIcon()).not.toBeNull()
  })

  it('hand_icon_shows_again_when_level_1_is_retried_after_a_loss', async () => {
    const user = userEvent.setup()
    await playSeconds(wallAt / 12 + 1)
    await user.click(screen.getByRole('button', { name: strings.retry }))
    await playFrames(1)

    expect(handIcon()).not.toBeNull()
  })

  it('hand_icon_shows_again_when_level_1_is_started_from_the_title', async () => {
    const user = userEvent.setup()
    await playSeconds(4.1)
    await user.click(screen.getByRole('button', { name: strings.pause }))
    await user.click(screen.getByRole('button', { name: strings.quitToTitle }))
    await startLevel1()

    expect(handIcon()).not.toBeNull()
  })

  it('hand_icon_never_shows_on_another_level', async () => {
    await act(() => game.nextLevel())
    await playFrames(1)

    expect(handIcon()).toBeNull()

    await playSeconds(1)

    expect(handIcon()).toBeNull()
  })

  // At the run speed of 12 units/s, 2 s of play take the squad 24 units, give or take the tick a frame carries over.
  it('hand_icon_does_not_pause_or_slow_the_run', async () => {
    await playSeconds(2)

    expect(handIcon()).not.toBeNull()
    expect(drawnSquads.at(-1)?.z).toBeCloseTo(24, 0)
  })

  it('drag_that_starts_on_the_hand_icon_steers', async () => {
    const icon = handIcon()
    if (icon === null) throw new Error('no hand icon to drag on')
    await drag(icon, 50)
    await playFrames(1)

    expect(drawnSquads.at(-1)?.steeringPoint).toBeCloseTo(50 / pixelsPerTrackUnit)
  })
})
