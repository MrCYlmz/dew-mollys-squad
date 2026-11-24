// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../../../src/content/strings'
import { Hud } from '../../../src/ui/screens/Hud'

afterEach(cleanup)

describe('HUD', () => {
  it('hud_shows_the_level_progress_bar', () => {
    render(<Hud level={1} progress={0.25} boss={null} onPause={() => {}} />)

    expect(screen.getByRole('progressbar', { name: strings.levelProgress })).toBeTruthy()
  })

  it('pause_button_opens_the_pause_screen', async () => {
    const user = userEvent.setup()
    const onPause = vi.fn()
    render(<Hud level={1} progress={0.25} boss={null} onPause={onPause} />)

    await user.click(screen.getByRole('button', { name: strings.pause }))

    expect(onPause).toHaveBeenCalledTimes(1)
  })
})

// requirements S-6 (14a): the HUD shows the level file's level number as "Level N".
describe('level number', () => {
  it.each([1, 7, 10])('hud_shows_level_%i', (level) => {
    render(<Hud level={level} progress={0.25} boss={null} onPause={() => {}} />)

    expect(screen.getByText(`Level ${level}`)).toBeTruthy()
  })
})

describe('boss HP bar', () => {
  it('no_boss_hp_bar_shows_before_the_boss_arena', () => {
    render(<Hud level={1} progress={0.5} boss={null} onPause={() => {}} />)

    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(screen.queryByRole('progressbar', { name: strings.bossHp })).toBeNull()
  })

  it('boss_hp_bar_shows_the_hp_left_out_of_the_full_hp', () => {
    render(<Hud level={1} progress={1} boss={{ hp: 240, fullHp: 960 }} onPause={() => {}} />)

    const bar = screen.getByRole('progressbar', { name: strings.bossHp })
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(bar.getAttribute('aria-valuenow')).toBe('25')
  })

  it('boss_hp_bar_is_full_when_the_boss_enters', () => {
    render(<Hud level={1} progress={1} boss={{ hp: 960, fullHp: 960 }} onPause={() => {}} />)

    expect(screen.getByRole('progressbar', { name: strings.bossHp }).getAttribute('aria-valuenow')).toBe('100')
  })

  it('level_progress_bar_still_shows_in_the_boss_arena', () => {
    render(<Hud level={1} progress={1} boss={{ hp: 960, fullHp: 960 }} onPause={() => {}} />)

    expect(screen.getByRole('progressbar', { name: strings.levelProgress })).toBeTruthy()
  })
})
