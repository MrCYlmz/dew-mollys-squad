// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import type { Game, GameView } from '../../src/app/game'
import { strings } from '../../src/content/strings'

afterEach(cleanup)

// The game itself needs WebGL; App only needs its view, its subscription and its intents.
function fakeGame() {
  const view: GameView = { screen: 'title', squadCount: 1, progress: 0, boss: null, handIcon: false }
  const game = { view, subscribe: () => () => {}, play: vi.fn(), setSquadLabel: () => {} }
  return { game: game as unknown as Game, play: game.play }
}

// requirements S-7 (9) and decisions.md: a failed load of the game's chunk shows "Couldn't load the game. Tap to
// retry."; the tap loads it again and counts as play, so the run starts once the game arrives.
describe('failed game load', () => {
  it('failed_load_shows_the_retry_message', async () => {
    render(<App loadGame={() => Promise.reject(new Error('chunk failed'))} />)

    expect(strings.loadFailed).toBe("Couldn't load the game. Tap to retry.")
    expect(await screen.findByRole('button', { name: new RegExp(strings.loadFailed) })).toBeTruthy()
  })

  it('tap_on_the_retry_message_loads_the_game_again', async () => {
    const user = userEvent.setup()
    const loadGame = vi.fn(() => Promise.reject(new Error('chunk failed')))
    render(<App loadGame={loadGame} />)

    await user.click(await screen.findByRole('button', { name: new RegExp(strings.loadFailed) }))

    await vi.waitFor(() => expect(loadGame).toHaveBeenCalledTimes(2))
  })

  it('retry_that_fails_again_shows_the_retry_message_again', async () => {
    const user = userEvent.setup()
    const loadGame = vi.fn(() => Promise.reject(new Error('chunk failed')))
    render(<App loadGame={loadGame} />)

    await user.click(await screen.findByRole('button', { name: new RegExp(strings.loadFailed) }))

    await vi.waitFor(() => expect(loadGame).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: new RegExp(strings.loadFailed) })).toBeTruthy()
  })

  it('successful_retry_starts_the_run', async () => {
    const user = userEvent.setup()
    const { game, play } = fakeGame()
    const loadGame = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValueOnce(game)
    render(<App loadGame={loadGame} />)

    await user.click(await screen.findByRole('button', { name: new RegExp(strings.loadFailed) }))

    await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1))
  })

  it('loaded_game_shows_tap_to_play_without_the_retry_message', async () => {
    const { game, play } = fakeGame()
    render(<App loadGame={() => Promise.resolve(game)} />)

    expect(await screen.findByRole('button', { name: new RegExp(strings.tapToPlay) })).toBeTruthy()
    expect(screen.queryByText(strings.loadFailed)).toBeNull()
    expect(play).not.toHaveBeenCalled()
  })
})
