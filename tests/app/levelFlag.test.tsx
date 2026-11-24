// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { Game } from '../../src/app/game'
import { readLaunchFlags } from '../../src/app/launchFlags'
import type { Level } from '../../src/content/level'
import { strings } from '../../src/content/strings'
import type { RunState } from '../../src/sim/run'
import { levelOf } from '../sim/runHarness'

// requirements S-11 (16–17): the hidden URL flag ?level=N makes the title's tap start level N, if a level with that
// number exists; level order, retry and restart go on from there. Otherwise the game starts at level 1, and the flag shows
// nothing a player could use.

// The squad's distance travelled at each drawn frame.
const drawnSquadZ: number[] = []

// Three.js needs WebGL, which the test environment lacks; the run is checked through the HUD and what render is asked to draw.
vi.mock('../../src/render/gameRenderer', () => ({
  GameRenderer: class {
    constructor() {
      return new Proxy(this, {
        get: (renderer, member) =>
          member === 'draw' ? (state: RunState) => drawnSquadZ.push(state.squad.z) : (Reflect.get(renderer, member) ?? (() => {})),
      })
    }
  },
}))

// Short roads, so a run is won in a few seconds; level 12 has a wall across the whole track to lose a run on purpose.
function shortLevel(level: number, events: Level['events'] = []): Level {
  return { ...levelOf(events, 30, level), id: `level-${level}` }
}
const world = [shortLevel(13), shortLevel(1), shortLevel(12), shortLevel(2)]
const worldWithWall = [shortLevel(1), shortLevel(12, [{ type: 'wall', z: 10, x: 0, width: 10 }]), shortLevel(13)]

let pendingFrame: { id: number; callback: FrameRequestCallback } | null = null
let lastFrameId = 0
let clock = 0
let game: Game | null = null

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

// Opens the game as main.tsx does, with the flags read from the URL's query.
function openGame(levels: Level[], search: string): void {
  const gameElement = document.createElement('div')
  const canvas = document.createElement('canvas')
  const uiRoot = document.createElement('div')
  gameElement.append(canvas, uiRoot)
  document.body.append(gameElement)
  const opened = new Game(levels, canvas, gameElement, readLaunchFlags(search))
  game = opened
  render(<App loadGame={() => Promise.resolve(opened)} />, { container: uiRoot })
}

async function tapToPlay(): Promise<void> {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: new RegExp(strings.tapToPlay) }))
  // The first frame only sets the loop's clock.
  await playFrames(1)
}

function shownLevel(): number | null {
  const text = screen.queryByText(/^Level \d+$/)?.textContent
  return text ? Number(text.replace('Level ', '')) : null
}

beforeEach(() => {
  drawnSquadZ.length = 0
  pendingFrame = null
  clock = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pendingFrame = { id: ++lastFrameId, callback }
    return lastFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (pendingFrame?.id === id) pendingFrame = null
  })
})

afterEach(() => {
  cleanup()
  game?.dispose()
  game = null
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('level flag', () => {
  it('title_tap_starts_level_12_with_the_flag_level_12', async () => {
    openGame(world, '?level=12')

    await tapToPlay()

    expect(shownLevel()).toBe(12)
  })

  it('title_tap_starts_level_1_without_the_flag', async () => {
    openGame(world, '')

    await tapToPlay()

    expect(shownLevel()).toBe(1)
  })

  it('victory_on_the_flagged_level_goes_on_to_the_next_level_number', async () => {
    const user = userEvent.setup()
    openGame(world, '?level=12')
    await tapToPlay()

    await playFrames(5 * 60)
    await user.click(await screen.findByRole('button', { name: strings.nextLevel }))
    await playFrames(1)

    expect(shownLevel()).toBe(13)
  })

  it('retry_after_a_loss_on_the_flagged_level_replays_it', async () => {
    const user = userEvent.setup()
    openGame(worldWithWall, '?level=12')
    await tapToPlay()

    await playFrames(5 * 60)
    await user.click(await screen.findByRole('button', { name: strings.retry }))
    await playFrames(2)

    expect(shownLevel()).toBe(12)
    expect(drawnSquadZ.at(-1)).toBeLessThan(1)
  })

  it('restart_from_the_pause_screen_replays_the_flagged_level', async () => {
    const user = userEvent.setup()
    openGame(world, '?level=12')
    await tapToPlay()
    await playFrames(30)

    await user.click(screen.getByRole('button', { name: strings.pause }))
    await user.click(screen.getByRole('button', { name: strings.restart }))
    await playFrames(2)

    expect(shownLevel()).toBe(12)
    expect(drawnSquadZ.at(-1)).toBeLessThan(1)
  })

  it('title_tap_after_quitting_to_the_title_starts_the_flagged_level_again', async () => {
    const user = userEvent.setup()
    openGame(world, '?level=12')
    await tapToPlay()
    await user.click(screen.getByRole('button', { name: strings.pause }))
    await user.click(screen.getByRole('button', { name: strings.quitToTitle }))

    await tapToPlay()

    expect(shownLevel()).toBe(12)
  })

  it.each(['?level=99', '?level=0', '?level=12.5', '?level=abc', '?level='])('title_tap_with_the_flag_%s_starts_level_1', async (search) => {
    openGame(world, search)

    await tapToPlay()

    expect(shownLevel()).toBe(1)
  })

  // Nothing on the title screen gives the flag away: it offers the same buttons as without it.
  it('title_screen_with_the_flag_shows_no_level_choice', async () => {
    openGame(world, '')
    await screen.findByRole('button', { name: new RegExp(strings.tapToPlay) })
    const withoutFlag = screen.getAllByRole('button').map((button) => button.textContent)
    cleanup()
    game?.dispose()

    openGame(world, '?level=12')
    await screen.findByRole('button', { name: new RegExp(strings.tapToPlay) })

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(withoutFlag)
  })
})
