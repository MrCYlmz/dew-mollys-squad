// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { DefeatScreen } from '../../../src/ui/screens/DefeatScreen'

afterEach(cleanup)

describe('defeat screen', () => {
  it('defeat_shows_the_distance_reached', () => {
    render(<DefeatScreen distanceReached={137} caughtBy={null} onRetry={() => {}} />)

    expect(screen.getByText(new RegExp(strings.distanceReached))).toBeTruthy()
    expect(screen.getByText(/\b137\b/)).toBeTruthy()
  })

  it('one_tap_on_retry_restarts_the_level', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<DefeatScreen distanceReached={137} caughtBy={null} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: strings.retry }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('defeat_at_0_cats_shows_out_of_cats', () => {
    render(<DefeatScreen distanceReached={137} caughtBy={null} onRetry={() => {}} />)

    expect(screen.getByRole('heading', { name: strings.defeat })).toBeTruthy()
  })

  it.each([
    ['dustbot', strings.caughtByDustbot],
    ['megaDustbot', strings.caughtByMegaDustbot],
  ] as const)('defeat_by_the_%s_shows_that_it_caught_the_squad', (boss, reason) => {
    render(<DefeatScreen distanceReached={300} caughtBy={boss} onRetry={() => {}} />)

    expect(screen.getByRole('heading', { name: reason })).toBeTruthy()
    expect(screen.queryByText(strings.defeat)).toBeNull()
  })
})
