// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { VictoryScreen } from '../../../src/ui/screens/VictoryScreen'

afterEach(cleanup)

describe('victory screen', () => {
  it('victory_shows_level_complete_and_the_cats_left', () => {
    render(<VictoryScreen catsLeft={37} onPlayAgain={() => {}} onBackToTitle={() => {}} />)

    expect(strings.levelComplete).toBe('Level complete')
    expect(screen.getByText(strings.levelComplete)).toBeTruthy()
    expect(screen.getByText(new RegExp(strings.catsLeft))).toBeTruthy()
    expect(screen.getByText(/\b37\b/)).toBeTruthy()
  })

  it('play_again_button_restarts_the_level', async () => {
    const user = userEvent.setup()
    const onPlayAgain = vi.fn()
    const onBackToTitle = vi.fn()
    render(<VictoryScreen catsLeft={37} onPlayAgain={onPlayAgain} onBackToTitle={onBackToTitle} />)

    await user.click(screen.getByRole('button', { name: strings.playAgain }))

    expect(onPlayAgain).toHaveBeenCalledTimes(1)
    expect(onBackToTitle).not.toHaveBeenCalled()
  })

  it('back_to_title_button_goes_to_the_title', async () => {
    const user = userEvent.setup()
    const onPlayAgain = vi.fn()
    const onBackToTitle = vi.fn()
    render(<VictoryScreen catsLeft={37} onPlayAgain={onPlayAgain} onBackToTitle={onBackToTitle} />)

    await user.click(screen.getByRole('button', { name: strings.backToTitle }))

    expect(onBackToTitle).toHaveBeenCalledTimes(1)
    expect(onPlayAgain).not.toHaveBeenCalled()
  })
})
