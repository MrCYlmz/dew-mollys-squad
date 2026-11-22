// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { VictoryScreen } from '../../../src/ui/screens/VictoryScreen'

afterEach(cleanup)

describe('victory screen', () => {
  it('victory_shows_level_complete_and_the_cats_left', () => {
    render(<VictoryScreen catsLeft={37} onNextLevel={() => {}} onBackToTitle={() => {}} />)

    expect(strings.levelComplete).toBe('Level complete')
    expect(screen.getByText(strings.levelComplete)).toBeTruthy()
    expect(screen.getByText(new RegExp(strings.catsLeft))).toBeTruthy()
    expect(screen.getByText(/\b37\b/)).toBeTruthy()
  })

  // docs/domain/screens.md: Victory's main action is the next level in level order.
  it('next_level_button_asks_for_the_next_level', async () => {
    const user = userEvent.setup()
    const onNextLevel = vi.fn()
    const onBackToTitle = vi.fn()
    render(<VictoryScreen catsLeft={37} onNextLevel={onNextLevel} onBackToTitle={onBackToTitle} />)

    await user.click(screen.getByRole('button', { name: strings.nextLevel }))

    expect(onNextLevel).toHaveBeenCalledTimes(1)
    expect(onBackToTitle).not.toHaveBeenCalled()
  })

  it('back_to_title_button_goes_to_the_title', async () => {
    const user = userEvent.setup()
    const onNextLevel = vi.fn()
    const onBackToTitle = vi.fn()
    render(<VictoryScreen catsLeft={37} onNextLevel={onNextLevel} onBackToTitle={onBackToTitle} />)

    await user.click(screen.getByRole('button', { name: strings.backToTitle }))

    expect(onBackToTitle).toHaveBeenCalledTimes(1)
    expect(onNextLevel).not.toHaveBeenCalled()
  })
})
