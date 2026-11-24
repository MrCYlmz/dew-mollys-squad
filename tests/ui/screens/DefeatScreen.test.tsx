// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { DefeatScreen } from '../../../src/ui/screens/DefeatScreen'

afterEach(cleanup)

describe('defeat screen', () => {
  it('defeat_shows_the_distance_reached', () => {
    render(<DefeatScreen distanceReached={137} lossCause="outOfCats" caughtBy={null} onRetry={() => {}} />)

    expect(screen.getByText(new RegExp(strings.distanceReached))).toBeTruthy()
    expect(screen.getByText(/\b137\b/)).toBeTruthy()
  })

  it('one_tap_on_retry_restarts_the_level', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<DefeatScreen distanceReached={137} lossCause="outOfCats" caughtBy={null} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: strings.retry }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('defeat_at_0_cats_shows_out_of_cats', () => {
    render(<DefeatScreen distanceReached={137} lossCause="outOfCats" caughtBy={null} onRetry={() => {}} />)

    expect(screen.getByRole('heading', { name: strings.defeat })).toBeTruthy()
  })

  it.each([
    ['dustbot', strings.caughtByDustbot],
    ['megaDustbot', strings.caughtByMegaDustbot],
  ] as const)('defeat_by_the_%s_shows_that_it_caught_the_squad', (boss, reason) => {
    render(<DefeatScreen distanceReached={300} lossCause="caughtByBoss" caughtBy={boss} onRetry={() => {}} />)

    expect(screen.getByRole('heading', { name: reason })).toBeTruthy()
    expect(screen.queryByText(strings.defeat)).toBeNull()
  })

  // The texts from docs/domain/screens.md.
  it.each([
    ['ranIntoWall', 'Ran into a wall'],
    ['ranIntoBlock', 'Ran into a block'],
  ] as const)('defeat_by_%s_names_the_obstacle', (lossCause, reason) => {
    render(<DefeatScreen distanceReached={160} lossCause={lossCause} caughtBy={null} onRetry={() => {}} />)

    expect(screen.getByRole('heading', { name: reason })).toBeTruthy()
    expect(screen.queryByText(strings.defeat)).toBeNull()
  })
})

// requirements S-6 (14, 15) and docs/domain/screens.md: one tip under the loss reason, chosen by why the run was lost.
const outOfCatsTip = 'Take the blue gates and shoot the dogs before they reach you.'
const obstacleTip = 'Steer into a free lane early: walls and blocks end the run.'
const bossTip = 'Grow your squad before the boss: more cats, more yarn.'
const tips = [outOfCatsTip, obstacleTip, bossTip]

describe('defeat tip', () => {
  it.each([
    ['out_of_cats', 'outOfCats', null, strings.defeat, outOfCatsTip],
    ['running_into_a_wall', 'ranIntoWall', null, strings.ranIntoWall, obstacleTip],
    ['running_into_a_block', 'ranIntoBlock', null, strings.ranIntoBlock, obstacleTip],
    ['the_dustbot', 'caughtByBoss', 'dustbot', strings.caughtByDustbot, bossTip],
    ['the_mega_dustbot', 'caughtByBoss', 'megaDustbot', strings.caughtByMegaDustbot, bossTip],
  ] as const)('defeat_by_%s_shows_its_tip_under_the_loss_reason', (_case, lossCause, caughtBy, reason, tip) => {
    render(<DefeatScreen distanceReached={160} lossCause={lossCause} caughtBy={caughtBy} onRetry={() => {}} />)

    const shownTip = screen.getByText(tip)
    const heading = screen.getByRole('heading', { name: reason })
    expect(heading.compareDocumentPosition(shownTip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    ['outOfCats', null, outOfCatsTip],
    ['ranIntoWall', null, obstacleTip],
    ['caughtByBoss', 'megaDustbot', bossTip],
  ] as const)('defeat_by_%s_shows_no_other_tip', (lossCause, caughtBy, tip) => {
    render(<DefeatScreen distanceReached={160} lossCause={lossCause} caughtBy={caughtBy} onRetry={() => {}} />)

    for (const otherTip of tips.filter((shown) => shown !== tip)) expect(screen.queryByText(otherTip)).toBeNull()
  })

  it.each(tips)('tip_%s_lives_in_the_string_table', (tip) => {
    expect(Object.values(strings)).toContain(tip)
  })
})
