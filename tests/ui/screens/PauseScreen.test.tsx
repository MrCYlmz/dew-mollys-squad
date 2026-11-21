// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { PauseScreen } from '../../../src/ui/screens/PauseScreen'

afterEach(cleanup)

function renderPauseScreen() {
  const intents = { onResume: vi.fn(), onRestart: vi.fn(), onQuit: vi.fn() }
  render(<PauseScreen {...intents} />)
  return intents
}

describe('pause screen', () => {
  it('resume_button_resumes_the_run', async () => {
    const user = userEvent.setup()
    const intents = renderPauseScreen()

    await user.click(screen.getByRole('button', { name: strings.resume }))

    expect(intents.onResume).toHaveBeenCalledTimes(1)
    expect(intents.onRestart).not.toHaveBeenCalled()
    expect(intents.onQuit).not.toHaveBeenCalled()
  })

  it('restart_button_restarts_the_level', async () => {
    const user = userEvent.setup()
    const intents = renderPauseScreen()

    await user.click(screen.getByRole('button', { name: strings.restart }))

    expect(intents.onRestart).toHaveBeenCalledTimes(1)
    expect(intents.onResume).not.toHaveBeenCalled()
  })

  it('quit_button_goes_back_to_the_title', async () => {
    const user = userEvent.setup()
    const intents = renderPauseScreen()

    await user.click(screen.getByRole('button', { name: strings.quitToTitle }))

    expect(intents.onQuit).toHaveBeenCalledTimes(1)
    expect(intents.onResume).not.toHaveBeenCalled()
  })
})
