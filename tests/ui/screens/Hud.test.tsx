// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { Hud } from '../../../src/ui/screens/Hud'

afterEach(cleanup)

describe('HUD', () => {
  it('hud_shows_the_level_progress_bar', () => {
    render(<Hud progress={0.25} onPause={() => {}} />)

    expect(screen.getByRole('progressbar', { name: strings.levelProgress })).toBeTruthy()
  })

  it('pause_button_opens_the_pause_screen', async () => {
    const user = userEvent.setup()
    const onPause = vi.fn()
    render(<Hud progress={0.25} onPause={onPause} />)

    await user.click(screen.getByRole('button', { name: strings.pause }))

    expect(onPause).toHaveBeenCalledTimes(1)
  })
})
