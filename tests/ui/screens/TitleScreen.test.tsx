// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { TitleScreen } from '../../../src/ui/screens/TitleScreen'

afterEach(cleanup)

describe('title screen', () => {
  it('title_shows_the_game_name_and_tap_to_play', () => {
    render(<TitleScreen onPlay={() => {}} />)

    expect(strings.tapToPlay).toBe('Tap to play')
    expect(screen.getByText(strings.gameName)).toBeTruthy()
    expect(screen.getByText(strings.tapToPlay)).toBeTruthy()
  })

  it('one_tap_on_the_title_starts_the_level', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<TitleScreen onPlay={onPlay} />)

    await user.click(screen.getByRole('button', { name: new RegExp(strings.tapToPlay) }))

    expect(onPlay).toHaveBeenCalledTimes(1)
  })
})
