// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { DefeatScreen } from '../../../src/ui/screens/DefeatScreen'

afterEach(cleanup)

describe('defeat screen', () => {
  it('defeat_shows_the_distance_reached', () => {
    render(<DefeatScreen distanceReached={137} onRetry={() => {}} />)

    expect(screen.getByText(new RegExp(strings.distanceReached))).toBeTruthy()
    expect(screen.getByText(/\b137\b/)).toBeTruthy()
  })

  it('one_tap_on_retry_restarts_the_level', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<DefeatScreen distanceReached={137} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: strings.retry }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
